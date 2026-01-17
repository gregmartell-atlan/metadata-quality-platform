// ============================================
// UNIFIED API SERVER
// Handles Atlan API proxy + Snowflake/MDLH
// Run with: node proxy-server.js
// ============================================

// Global error handlers to catch crashes
process.on('uncaughtException', (err) => {
  console.error('=== UNCAUGHT EXCEPTION ===');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  console.error('========================');
  // Don't exit - try to keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('=== UNHANDLED REJECTION ===');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  console.error('===========================');
});

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { sessionManager, connectSnowflake, executeQuery } from './server/sessions.js';
import * as queries from './server/mdlh-queries.js';

const app = express();
const PORT = process.env.PROXY_PORT || 3002;

// ============================================
// CORS Configuration
// ============================================
const explicitAllowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const originAllowlist = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  ...explicitAllowedOrigins.map((o) => new RegExp(`^${o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = originAllowlist.some((re) => re.test(origin));
    return callback(allowed ? null : new Error(`CORS blocked: ${origin}`), allowed);
  },
  credentials: true,
}));

app.use(express.json());

// ============================================
// Helper: Get session from request
// ============================================
function getSession(req) {
  const sessionId = req.headers['x-session-id'] || req.query.session_id;
  if (sessionId) {
    return { sessionId, session: sessionManager.getSession(sessionId) };
  }
  // Fall back to any active session
  return sessionManager.getAnySession() || { sessionId: null, session: null };
}

function requireSession(req, res, next) {
  const { session } = getSession(req);
  if (!session) {
    return res.status(503).json({
      error: 'No active Snowflake connection',
      message: 'Connect via POST /api/snowflake/connect first',
    });
  }
  req.snowflakeSession = session;
  next();
}

// ============================================
// Health Check
// ============================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// ATLAN API PROXY
// ============================================
app.use('/proxy', async (req, res) => {
  console.log(`[Proxy] ${req.method} ${req.originalUrl}`);

  try {
    const atlanUrl = req.headers['x-atlan-url'];
    const apiKey = req.headers['x-atlan-api-key'];

    if (!atlanUrl) return res.status(400).json({ error: 'Missing X-Atlan-URL header' });
    if (!apiKey) return res.status(400).json({ error: 'Missing X-Atlan-API-Key header' });

    const path = req.originalUrl.replace('/proxy', '');
    const targetUrl = `${atlanUrl}${path}`;

    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(targetUrl, { ...fetchOptions, signal: controller.signal });
    clearTimeout(timeout);

    const contentType = response.headers.get('content-type');
    const data = contentType?.includes('application/json') ? await response.json() : await response.text();

    if (typeof data === 'string' && (data.includes('<!DOCTYPE') || data.includes('<html'))) {
      return res.status(401).json({
        error: 'Authentication failed or wrong Atlan URL',
        message: 'The server returned HTML instead of JSON',
      });
    }

    res.status(response.status);
    typeof data === 'string' ? res.send(data) : res.json(data);
  } catch (error) {
    console.error('[Proxy Error]', error.message);
    res.status(500).json({ error: 'Proxy request failed', message: error.message });
  }
});

// ============================================
// SNOWFLAKE ROUTES
// ============================================

// Get configuration
app.get('/api/snowflake/config', (req, res) => {
  res.json({
    mdlh_enabled: process.env.MDLH_ENABLED === 'true',
    data_backend: process.env.DATA_BACKEND || 'api',
    snowflake_account: process.env.SNOWFLAKE_ACCOUNT || null,
    snowflake_warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
    snowflake_database: process.env.SNOWFLAKE_DATABASE || 'ATLAN_GOLD',
    snowflake_schema: process.env.SNOWFLAKE_SCHEMA || 'PUBLIC',
  });
});

// Get connection status
app.get('/api/snowflake/status', (req, res) => {
  const stats = sessionManager.getStats();

  if (stats.activeSessions > 0 && stats.sessions.length > 0) {
    const session = stats.sessions[0]; // Most recently used
    return res.json({
      connected: true,
      user: session.user,
      session_id: session.fullSessionId,
      warehouse: session.warehouse,
      database: session.database,
      role: session.role,
      created_at: session.createdAt,
      last_used_at: session.lastUsed,
    });
  }

  res.json({
    connected: false,
    user: null,
    session_id: null,
  });
});

// Connect to Snowflake
// SSO connections can take 2-3 minutes while user authenticates in browser
app.post('/api/snowflake/connect', async (req, res) => {
  // Disable timeout for this endpoint - SSO can take a while
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000);

  try {
    const {
      account,
      user,
      token,
      auth_type = 'token',
      warehouse = process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
      database = process.env.SNOWFLAKE_DATABASE || 'ATLAN_GOLD',
      schema_name = process.env.SNOWFLAKE_SCHEMA || 'PUBLIC',
      role,
    } = req.body;

    if (!account || !user) {
      return res.status(400).json({ connected: false, error: 'account and user are required' });
    }

    console.log(`[Connect] Starting ${auth_type} connection for ${user}@${account}...`);

    const result = await connectSnowflake({
      account,
      user,
      token,
      authType: auth_type,
      warehouse,
      database,
      schema: schema_name,
      role,
    });

    console.log(`[Connect] Success! User: ${result.user}, Session: ${result.sessionId?.slice(0, 8)}...`);
    res.json(result);
  } catch (error) {
    console.error('[Connect Error]', error.message);

    const errMsg = error.message.toLowerCase();
    if (errMsg.includes('authentication') || errMsg.includes('password') || errMsg.includes('token')) {
      return res.status(401).json({ connected: false, error: 'Authentication failed' });
    }
    if (errMsg.includes('timeout') || errMsg.includes('timed out')) {
      return res.status(408).json({ connected: false, error: 'Connection timed out. Please try again.' });
    }
    if (errMsg.includes('abort') || errMsg.includes('cancel')) {
      return res.status(499).json({ connected: false, error: 'Connection cancelled by user' });
    }

    res.status(500).json({ connected: false, error: error.message });
  }
});

// Disconnect
app.post('/api/snowflake/disconnect', async (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.query.session_id;
  if (!sessionId) {
    return res.json({ disconnected: false, message: 'No session ID provided' });
  }

  const removed = await sessionManager.removeSession(sessionId);
  res.json({ disconnected: removed, message: removed ? 'Session closed' : 'Session not found' });
});

// List sessions (debug)
app.get('/api/snowflake/sessions', (req, res) => {
  res.json(sessionManager.getStats());
});

// Session status check
app.get('/api/snowflake/session/status', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) {
    return res.status(401).json({ valid: false, reason: 'NO_SESSION_ID', message: 'No session ID provided' });
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(401).json({ valid: false, reason: 'SESSION_NOT_FOUND', message: 'Session not found' });
  }

  res.json({
    valid: true,
    user: session.user,
    warehouse: session.warehouse,
    database: session.database,
    schema_name: session.schema,
    role: session.role,
    query_count: session.queryCount,
    idle_seconds: Math.floor((Date.now() - session.lastUsed.getTime()) / 1000),
  });
});

// ============================================
// MDLH ROUTES
// ============================================

// Hierarchy: Connectors
app.get('/api/mdlh/hierarchy/connectors', requireSession, async (req, res) => {
  try {
    const results = await executeQuery(req.snowflakeSession, queries.SQL_HIERARCHY_CONNECTORS);
    const connectors = results
      .filter(r => r.CONNECTOR_NAME)
      .map(r => ({ name: r.CONNECTOR_NAME, asset_count: r.ASSET_COUNT }));
    res.json({ connectors });
  } catch (error) {
    console.error('[MDLH] hierarchy/connectors error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Hierarchy: Databases
app.get('/api/mdlh/hierarchy/databases', requireSession, async (req, res) => {
  try {
    const { connector } = req.query;
    if (!connector) return res.status(400).json({ error: 'connector query param required' });

    const results = await executeQuery(req.snowflakeSession, queries.SQL_HIERARCHY_DATABASES, [connector]);
    const databases = results
      .filter(r => r.DATABASE_NAME)
      .map(r => ({ name: r.DATABASE_NAME, asset_count: r.ASSET_COUNT, sample_guid: r.SAMPLE_GUID }));
    res.json({ databases, connector });
  } catch (error) {
    console.error('[MDLH] hierarchy/databases error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Hierarchy: Schemas
app.get('/api/mdlh/hierarchy/schemas', requireSession, async (req, res) => {
  try {
    const { connector, database } = req.query;
    if (!connector || !database) {
      return res.status(400).json({ error: 'connector and database query params required' });
    }

    const results = await executeQuery(req.snowflakeSession, queries.SQL_HIERARCHY_SCHEMAS, [connector, database]);
    const schemas = results
      .filter(r => r.SCHEMA_NAME)
      .map(r => ({ name: r.SCHEMA_NAME, asset_count: r.ASSET_COUNT, sample_guid: r.SAMPLE_GUID }));
    res.json({ schemas, connector, database });
  } catch (error) {
    console.error('[MDLH] hierarchy/schemas error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Hierarchy: Tables
app.get('/api/mdlh/hierarchy/tables', requireSession, async (req, res) => {
  try {
    const { connector, database, schema } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 500, 2000);

    if (!connector || !database || !schema) {
      return res.status(400).json({ error: 'connector, database, and schema query params required' });
    }

    const results = await executeQuery(req.snowflakeSession, queries.SQL_HIERARCHY_TABLES, [connector, database, schema, limit]);
    const tables = results
      .filter(r => r.GUID)
      .map(r => ({
        guid: r.GUID,
        name: r.ASSET_NAME,
        asset_type: r.ASSET_TYPE,
        qualified_name: r.ASSET_QUALIFIED_NAME,
        description: r.DESCRIPTION,
        certificate_status: r.CERTIFICATE_STATUS,
        has_lineage: r.HAS_LINEAGE || false,
        popularity_score: r.POPULARITY_SCORE,
        owner_users: parseArray(r.OWNER_USERS),
        tags: parseArray(r.TAGS),
        updated_at: r.UPDATED_AT,
      }));
    res.json({ tables, connector, database, schema, count: tables.length });
  } catch (error) {
    console.error('[MDLH] hierarchy/tables error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Asset detail
app.get('/api/mdlh/asset/:guid', requireSession, async (req, res) => {
  try {
    const results = await executeQuery(req.snowflakeSession, queries.SQL_ASSET_DETAIL, [req.params.guid]);
    if (results.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(results[0]);
  } catch (error) {
    console.error('[MDLH] asset/:guid error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Quality scores
app.get('/api/mdlh/quality-scores', requireSession, async (req, res) => {
  try {
    const { connector, database, schema, asset_type, limit = 1000, offset = 0 } = req.query;

    let sql = queries.SQL_QUALITY_SCORES;
    const binds = [];

    if (connector) {
      sql += ` AND A.CONNECTOR_NAME = ?`;
      binds.push(connector);
    }
    if (database) {
      sql += ` AND SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4) = ?`;
      binds.push(database);
    }
    if (schema) {
      sql += ` AND SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5) = ?`;
      binds.push(schema);
    }
    if (asset_type && asset_type !== 'all') {
      sql += ` AND UPPER(A.ASSET_TYPE) = ?`;
      binds.push(asset_type.toUpperCase());
    }

    sql += ` ORDER BY A.POPULARITY_SCORE DESC NULLS LAST LIMIT ? OFFSET ?`;
    binds.push(parseInt(limit), parseInt(offset));

    const results = await executeQuery(req.snowflakeSession, sql, binds);
    res.json({ assets: results, count: results.length, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    console.error('[MDLH] quality-scores error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Quality rollup
app.get('/api/mdlh/quality', requireSession, async (req, res) => {
  try {
    const { dimension = 'connector', asset_type } = req.query;
    const sql = queries.buildQualityRollupQuery(dimension, asset_type);
    const results = await executeQuery(req.snowflakeSession, sql);
    res.json({ dimension, rollup: results });
  } catch (error) {
    console.error('[MDLH] quality error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Lineage
app.get('/api/mdlh/lineage/:guid', requireSession, async (req, res) => {
  try {
    const results = await executeQuery(req.snowflakeSession, queries.SQL_LINEAGE, [req.params.guid]);
    res.json({ guid: req.params.guid, lineage: results });
  } catch (error) {
    console.error('[MDLH] lineage/:guid error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Schema introspection - returns MDLH Gold Layer schema metadata
app.get('/api/mdlh/schema', requireSession, async (req, res) => {
  try {
    const results = await executeQuery(req.snowflakeSession, queries.SQL_GET_SCHEMA_COLUMNS);

    // Transform to lowercase field names as mdlhClient expects
    const columns = results.map(r => ({
      table_name: r.TABLE_NAME,
      column_name: r.COLUMN_NAME,
      data_type: r.DATA_TYPE,
      is_nullable: r.IS_NULLABLE === 'YES',
      comment: r.COMMENT,
    }));

    // Get unique table names
    const tables = [...new Set(columns.map(c => c.table_name))];

    // Group by table
    const byTable = {};
    for (const col of columns) {
      if (!byTable[col.table_name]) {
        byTable[col.table_name] = [];
      }
      byTable[col.table_name].push(col);
    }

    res.json({
      discovered_at: new Date().toISOString(),
      columns,
      column_count: columns.length,
      tables,
      table_count: tables.length,
      by_table: byTable,
    });
  } catch (error) {
    console.error('[MDLH] schema error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Schema reconciliation - returns field reconciliation against MDLH schema
// Returns empty reconciliation array - frontend does the actual reconciliation
app.get('/api/mdlh/schema/reconcile', requireSession, async (req, res) => {
  try {
    const results = await executeQuery(req.snowflakeSession, queries.SQL_GET_SCHEMA_COLUMNS);

    // Transform columns to lowercase as mdlhClient expects
    const columns = results.map(r => ({
      table_name: r.TABLE_NAME,
      column_name: r.COLUMN_NAME,
      data_type: r.DATA_TYPE,
      is_nullable: r.IS_NULLABLE === 'YES',
      comment: r.COMMENT,
    }));

    // Get unique table names
    const tables = [...new Set(columns.map(c => c.table_name))];

    // Build by_category and by_table for summary
    const byTable = {};
    for (const table of tables) {
      const tableCols = columns.filter(c => c.table_name === table);
      byTable[table] = {
        expected: 0, // Frontend calculates this from unified-fields.ts
        available: tableCols.length,
        missing: 0,
      };
    }

    res.json({
      discovered_at: new Date().toISOString(),
      reconciliation: [], // Frontend handles reconciliation with unified-fields.ts
      summary: {
        total_expected: 0,
        available: columns.length,
        missing: 0,
        type_mismatch: 0,
        no_mapping: 0,
        by_category: {},
        by_table: byTable,
      },
    });
  } catch (error) {
    console.error('[MDLH] schema/reconcile error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// List schemas (for Tenant Config page)
app.get('/api/mdlh/schemas', requireSession, async (req, res) => {
  try {
    const results = await executeQuery(req.snowflakeSession, queries.SQL_GET_SCHEMA_COLUMNS);
    // Get unique table names
    const tables = [...new Set(results.map(r => r.TABLE_NAME))];
    res.json({ schemas: tables, count: tables.length });
  } catch (error) {
    console.error('[MDLH] schemas error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Hierarchy: Assets (flexible endpoint for loading assets at any hierarchy level)
// Returns raw UPPERCASE Snowflake format - mdlhClient.ts handles transformation
app.get('/api/mdlh/hierarchy/assets', requireSession, async (req, res) => {
  try {
    const { connector, database, schema, asset_type, limit = 1000, offset = 0 } = req.query;

    let sql = `
      SELECT
        A.GUID,
        A.ASSET_NAME,
        A.ASSET_TYPE,
        A.ASSET_QUALIFIED_NAME,
        A.DESCRIPTION,
        A.CONNECTOR_NAME,
        A.CERTIFICATE_STATUS,
        A.HAS_LINEAGE,
        A.POPULARITY_SCORE,
        A.OWNER_USERS,
        A.TAGS,
        A.TERM_GUIDS,
        A.README_GUID,
        A.UPDATED_AT,
        A.SOURCE_UPDATED_AT,
        SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4) AS DATABASE_NAME,
        SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5) AS SCHEMA_NAME
      FROM ATLAN_GOLD.PUBLIC.ASSETS A
      WHERE A.STATUS = 'ACTIVE'
    `;
    const binds = [];

    if (connector) {
      sql += ` AND A.CONNECTOR_NAME = ?`;
      binds.push(connector);
    }
    if (database) {
      sql += ` AND SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4) = ?`;
      binds.push(database);
    }
    if (schema) {
      sql += ` AND SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5) = ?`;
      binds.push(schema);
    }
    if (asset_type && asset_type !== 'all') {
      sql += ` AND UPPER(A.ASSET_TYPE) IN ('TABLE', 'VIEW', 'MATERIALIZEDVIEW')`;
    } else {
      // Default to tables/views for asset loading
      sql += ` AND UPPER(A.ASSET_TYPE) IN ('TABLE', 'VIEW', 'MATERIALIZEDVIEW')`;
    }

    sql += ` ORDER BY A.POPULARITY_SCORE DESC NULLS LAST, A.ASSET_NAME ASC LIMIT ? OFFSET ?`;
    binds.push(parseInt(limit), parseInt(offset));

    const results = await executeQuery(req.snowflakeSession, sql, binds);

    // Return raw Snowflake format (UPPERCASE) - mdlhClient.ts handles transformation
    res.json({
      assets: results,
      total_count: results.length, // Would need COUNT(*) query for actual total
      limit: parseInt(limit),
      offset: parseInt(offset),
      filters: { connector, database, schema },
    });
  } catch (error) {
    console.error('[MDLH] hierarchy/assets error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Direct Snowflake metadata queries (for exploring any database)
app.get('/api/mdlh/snowflake/databases', requireSession, async (req, res) => {
  try {
    const results = await executeQuery(req.snowflakeSession, 'SHOW DATABASES');
    const databases = results.map(r => r.name || r.NAME).filter(Boolean);
    res.json({ databases, count: databases.length, source: 'snowflake_direct' });
  } catch (error) {
    console.error('[MDLH] snowflake/databases error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mdlh/snowflake/schemas/:database', requireSession, async (req, res) => {
  try {
    const db = req.params.database.replace(/[^a-zA-Z0-9_]/g, '');
    const results = await executeQuery(req.snowflakeSession, `SHOW SCHEMAS IN DATABASE "${db}"`);
    const schemas = results.map(r => r.name || r.NAME).filter(s => s && s !== 'INFORMATION_SCHEMA');
    res.json({ database: db, schemas, count: schemas.length, source: 'snowflake_direct' });
  } catch (error) {
    console.error('[MDLH] snowflake/schemas error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mdlh/snowflake/tables/:database/:schema', requireSession, async (req, res) => {
  try {
    const db = req.params.database.replace(/[^a-zA-Z0-9_]/g, '');
    const schema = req.params.schema.replace(/[^a-zA-Z0-9_]/g, '');

    const tableResults = await executeQuery(req.snowflakeSession, `SHOW TABLES IN "${db}"."${schema}"`);
    const viewResults = await executeQuery(req.snowflakeSession, `SHOW VIEWS IN "${db}"."${schema}"`).catch(() => []);

    const tables = [
      ...tableResults.map(r => ({ name: r.name || r.NAME, type: 'TABLE', rows: r.rows || r.ROWS || 0 })),
      ...viewResults.map(r => ({ name: r.name || r.NAME, type: 'VIEW', rows: 0 })),
    ];

    res.json({ database: db, schema, tables, count: tables.length, source: 'snowflake_direct' });
  } catch (error) {
    console.error('[MDLH] snowflake/tables error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Utilities
// ============================================
function parseArray(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

// ============================================
// Graceful Shutdown
// ============================================
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  sessionManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Shutting down...');
  sessionManager.shutdown();
  process.exit(0);
});

// ============================================
// Start Server
// ============================================
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║  Unified API Server                                  ║
║  Running on http://localhost:${PORT}                    ║
║                                                      ║
║  Endpoints:                                          ║
║  ─────────────────────────────────────────────────   ║
║  GET  /health                Health check            ║
║  ALL  /proxy/*               Atlan API proxy         ║
║                                                      ║
║  Snowflake:                                          ║
║  GET  /api/snowflake/config  Get config              ║
║  GET  /api/snowflake/status  Connection status       ║
║  POST /api/snowflake/connect Connect                 ║
║  POST /api/snowflake/disconnect Disconnect           ║
║                                                      ║
║  MDLH:                                               ║
║  GET  /api/mdlh/hierarchy/*  Browse cataloged assets ║
║  GET  /api/mdlh/quality-scores Quality scores        ║
║  GET  /api/mdlh/lineage/:guid Lineage                ║
║  GET  /api/mdlh/snowflake/*  Direct Snowflake browse ║
╚══════════════════════════════════════════════════════╝
  `);
});
