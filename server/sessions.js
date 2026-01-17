/**
 * Snowflake Session Manager
 * Manages persistent Snowflake connections with automatic cleanup.
 */

import snowflake from 'snowflake-sdk';
import crypto from 'crypto';

// Configure snowflake-sdk with DEBUG logging to see what's happening
snowflake.configure({
  logLevel: process.env.SNOWFLAKE_LOG_LEVEL || 'DEBUG',
  insecureConnect: false
});

console.log('[Snowflake SDK] Initialized with logLevel:', process.env.SNOWFLAKE_LOG_LEVEL || 'DEBUG');

class SnowflakeSession {
  constructor(connection, { user, account, warehouse, database, schema, role }) {
    this.connection = connection;
    this.user = user;
    this.account = account;
    this.warehouse = warehouse;
    this.database = database;
    this.schema = schema;
    this.role = role;
    this.createdAt = new Date();
    this.lastUsed = new Date();
    this.queryCount = 0;
  }

  touch() {
    this.lastUsed = new Date();
    this.queryCount++;
  }

  isExpired(maxIdleMinutes = 30) {
    const idleMs = Date.now() - this.lastUsed.getTime();
    return idleMs > maxIdleMinutes * 60 * 1000;
  }

  async isAlive() {
    return new Promise((resolve) => {
      this.connection.execute({
        sqlText: 'SELECT 1',
        complete: (err) => resolve(!err),
      });
    });
  }

  async close() {
    return new Promise((resolve) => {
      this.connection.destroy((err) => {
        if (err) console.warn('[Session] Error closing connection:', err.message);
        resolve();
      });
    });
  }

  toJSON() {
    return {
      user: this.user,
      account: this.account,
      warehouse: this.warehouse,
      database: this.database,
      schema: this.schema,
      role: this.role,
      queryCount: this.queryCount,
      createdAt: this.createdAt.toISOString(),
      lastUsed: this.lastUsed.toISOString(),
      idleSeconds: Math.floor((Date.now() - this.lastUsed.getTime()) / 1000),
    };
  }
}

class SessionManager {
  constructor(maxIdleMinutes = 30, cleanupIntervalSeconds = 60) {
    this.sessions = new Map();
    this.maxIdleMinutes = maxIdleMinutes;

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, cleanupIntervalSeconds * 1000);
  }

  generateSessionId() {
    return crypto.randomUUID();
  }

  async createSession(connection, metadata) {
    const sessionId = this.generateSessionId();
    const session = new SnowflakeSession(connection, metadata);
    this.sessions.set(sessionId, session);
    console.log(`[Sessions] Created session ${sessionId.slice(0, 8)}... for ${metadata.user}`);
    return sessionId;
  }

  getSession(sessionId) {
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.isExpired(this.maxIdleMinutes)) {
      console.log(`[Sessions] Session ${sessionId.slice(0, 8)}... expired`);
      this.removeSession(sessionId);
      return null;
    }

    return session;
  }

  // Get any active session (for convenience)
  getAnySession() {
    for (const [sessionId, session] of this.sessions) {
      if (!session.isExpired(this.maxIdleMinutes)) {
        return { sessionId, session };
      }
    }
    return null;
  }

  async removeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.close();
      this.sessions.delete(sessionId);
      console.log(`[Sessions] Removed session ${sessionId.slice(0, 8)}...`);
      return true;
    }
    return false;
  }

  cleanupExpired() {
    let cleaned = 0;
    for (const [sessionId, session] of this.sessions) {
      if (session.isExpired(this.maxIdleMinutes)) {
        session.close().catch(() => {});
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[Sessions] Cleaned up ${cleaned} expired sessions`);
    }
  }

  getStats() {
    const sessions = Array.from(this.sessions.entries())
      .map(([id, s]) => ({
        sessionId: id.slice(0, 8) + '...',
        fullSessionId: id,
        ...s.toJSON(),
      }))
      .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));

    return {
      activeSessions: this.sessions.size,
      maxIdleMinutes: this.maxIdleMinutes,
      sessions,
    };
  }

  shutdown() {
    clearInterval(this.cleanupInterval);
    for (const [sessionId, session] of this.sessions) {
      session.close().catch(() => {});
    }
    this.sessions.clear();
    console.log('[Sessions] Shutdown complete');
  }
}

// Singleton instance
export const sessionManager = new SessionManager(30, 60);

/**
 * Connect to Snowflake
 */
export async function connectSnowflake({ account, user, token, authType, warehouse, database, schema, role }) {
  return new Promise((resolve, reject) => {
    const connectionOptions = {
      account,
      username: user,
      warehouse,
      database,
      schema,
      clientSessionKeepAlive: true,
      clientSessionKeepAliveHeartbeatFrequency: 3600,
    };

    if (role) {
      connectionOptions.role = role;
    }

    if (authType === 'token' || authType === 'oauth') {
      if (!token) {
        return reject(new Error('Token required for token/oauth authentication'));
      }
      connectionOptions.authenticator = 'OAUTH';
      connectionOptions.token = token;
    } else if (authType === 'sso' || authType === 'externalbrowser') {
      connectionOptions.authenticator = 'EXTERNALBROWSER';
    } else {
      return reject(new Error(`Unknown auth type: ${authType}`));
    }

    console.log(`[Snowflake] Connecting as ${user}@${account} via ${authType}...`);
    console.log('[Snowflake] Connection options:', JSON.stringify({
      account,
      username: user,
      authenticator: connectionOptions.authenticator,
      warehouse,
      database,
      schema,
    }, null, 2));

    const connection = snowflake.createConnection(connectionOptions);

    console.log('[Snowflake] Connection object created, calling connectAsync()...');
    console.log('[Snowflake] Browser window should open for SSO authentication...');

    // Use connectAsync() for SSO/external browser authentication
    // The callback-based connect() does NOT work with EXTERNALBROWSER authenticator
    connection.connectAsync()
      .then((conn) => {
        console.log('[Snowflake] ✓ Connection established, fetching session info...');

        // Get actual session info
        conn.execute({
          sqlText: 'SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE(), CURRENT_DATABASE(), CURRENT_SCHEMA()',
          complete: async (err, stmt, rows) => {
            if (err) {
              console.error('[Snowflake] Failed to get session info:', err.message);
              conn.destroy(() => {});
              return reject(err);
            }

            // Snowflake SDK returns rows as objects with column names as keys
            const row = rows[0];
            console.log('[Snowflake] Session info row:', JSON.stringify(row));

            // Column names are the function calls themselves
            const currentUser = row['CURRENT_USER()'] || Object.values(row)[0];
            const currentRole = row['CURRENT_ROLE()'] || Object.values(row)[1];
            const currentWarehouse = row['CURRENT_WAREHOUSE()'] || Object.values(row)[2];
            const currentDatabase = row['CURRENT_DATABASE()'] || Object.values(row)[3];
            const currentSchema = row['CURRENT_SCHEMA()'] || Object.values(row)[4];

            console.log('[Snowflake] Session info:', { currentUser, currentRole, currentWarehouse, currentDatabase, currentSchema });

            const sessionId = await sessionManager.createSession(conn, {
              user: currentUser,
              account,
              warehouse: currentWarehouse || warehouse,
              database: currentDatabase || database,
              schema: currentSchema || schema,
              role: currentRole,
            });

            resolve({
              connected: true,
              sessionId,
              user: currentUser,
              role: currentRole,
              warehouse: currentWarehouse || warehouse,
              database: currentDatabase || database,
              schema: currentSchema || schema,
            });
          },
        });
      })
      .catch((err) => {
        console.error('[Snowflake] Connection failed:', err.message);
        reject(err);
      });
  });
}

/**
 * Execute a query on a session
 */
export function executeQuery(session, sqlText, binds = []) {
  return new Promise((resolve, reject) => {
    session.touch();

    session.connection.execute({
      sqlText,
      binds,
      complete: (err, stmt, rows) => {
        if (err) {
          return reject(err);
        }

        // Snowflake SDK returns rows as objects with column names already
        // Just return them directly
        resolve(rows || []);
      },
    });
  });
}
