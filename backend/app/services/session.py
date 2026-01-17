"""
Session management for Snowflake connections.

Maintains persistent connections so users don't re-authenticate every query.
Sessions auto-expire after idle timeout and are cleaned up by background thread.
"""

import threading
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from collections import OrderedDict
from uuid import uuid4

import snowflake.connector


class SnowflakeSession:
    """Wrapper around a Snowflake connection with metadata."""
    
    def __init__(
        self,
        conn: snowflake.connector.SnowflakeConnection,
        user: str,
        account: str,
        warehouse: str,
        database: str,
        schema: str,
        role: Optional[str] = None
    ):
        self.conn = conn
        self.user = user
        self.account = account
        self.warehouse = warehouse
        self.database = database
        self.schema = schema
        self.role = role
        self.created_at = datetime.utcnow()
        self.last_used = datetime.utcnow()
        self.query_count = 0
    
    def touch(self):
        """Update last used timestamp."""
        self.last_used = datetime.utcnow()
        self.query_count += 1
    
    def is_expired(self, max_idle_minutes: int = 30) -> bool:
        """Check if session has been idle too long."""
        return datetime.utcnow() - self.last_used > timedelta(minutes=max_idle_minutes)
    
    def is_alive(self) -> bool:
        """Check if the underlying connection is still valid."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            return True
        except Exception:
            return False
    
    def close(self):
        """Close the underlying connection."""
        try:
            self.conn.close()
        except Exception:
            pass
    
    def to_dict(self) -> Dict[str, Any]:
        """Return session info as dictionary."""
        return {
            "user": self.user,
            "account": self.account,
            "warehouse": self.warehouse,
            "database": self.database,
            "schema": self.schema,
            "role": self.role,
            "query_count": self.query_count,
            "created_at": self.created_at.isoformat(),
            "last_used": self.last_used.isoformat(),
            "idle_seconds": (datetime.utcnow() - self.last_used).total_seconds(),
        }


class SessionManager:
    """Manages active Snowflake sessions with automatic cleanup."""
    
    def __init__(self, max_idle_minutes: int = 30, cleanup_interval_seconds: int = 60):
        self._sessions: Dict[str, SnowflakeSession] = {}
        self._lock = threading.RLock()
        self._max_idle_minutes = max_idle_minutes
        self._cleanup_interval = cleanup_interval_seconds
        self._running = True
        
        # Start background cleanup thread
        self._cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleanup_thread.start()
    
    def create_session(
        self,
        conn: snowflake.connector.SnowflakeConnection,
        user: str,
        account: str,
        warehouse: str,
        database: str,
        schema: str,
        role: Optional[str] = None
    ) -> str:
        """Create a new session and return its ID."""
        session_id = str(uuid4())
        session = SnowflakeSession(conn, user, account, warehouse, database, schema, role)
        
        with self._lock:
            self._sessions[session_id] = session
        
        return session_id
    
    def get_session(self, session_id: str) -> Optional[SnowflakeSession]:
        """Get a session by ID, returns None if not found or expired."""
        with self._lock:
            session = self._sessions.get(session_id)
            
            if session is None:
                return None
            
            # Check if expired
            if session.is_expired(self._max_idle_minutes):
                self._remove_session_unsafe(session_id)
                return None
            
            # Check if connection is still alive
            if not session.is_alive():
                self._remove_session_unsafe(session_id)
                return None
            
            session.touch()
            return session
    
    def remove_session(self, session_id: str) -> bool:
        """Explicitly remove a session (logout)."""
        with self._lock:
            return self._remove_session_unsafe(session_id)
    
    def _remove_session_unsafe(self, session_id: str) -> bool:
        """Internal: remove session without lock (caller must hold lock)."""
        session = self._sessions.pop(session_id, None)
        if session:
            session.close()
            return True
        return False
    
    def _cleanup_loop(self):
        """Background thread that cleans up expired sessions."""
        while self._running:
            time.sleep(self._cleanup_interval)
            self._cleanup_expired()
    
    def _cleanup_expired(self):
        """Remove all expired sessions."""
        with self._lock:
            expired = [
                sid for sid, session in self._sessions.items()
                if session.is_expired(self._max_idle_minutes)
            ]
            for sid in expired:
                self._remove_session_unsafe(sid)
            
            if expired:
                print(f"[SessionManager] Cleaned up {len(expired)} expired sessions")
    
    def get_stats(self, include_full_session_ids: bool = False) -> Dict[str, Any]:
        """Get session manager statistics.

        Args:
            include_full_session_ids: If True, include full session IDs (for internal use).
                                     If False, truncate for display (default).
        """
        with self._lock:
            # Sort sessions by last_used (most recent first)
            sorted_sessions = sorted(
                self._sessions.items(),
                key=lambda x: x[1].last_used,
                reverse=True
            )

            return {
                "active_sessions": len(self._sessions),
                "max_idle_minutes": self._max_idle_minutes,
                "sessions": [
                    {
                        "session_id": sid if include_full_session_ids else (sid[:8] + "..."),
                        "full_session_id": sid,  # Always include full ID for internal use
                        "user": s.user,
                        "warehouse": s.warehouse,
                        "database": s.database,
                        "schema": s.schema,
                        "role": s.role,
                        "auth_method": getattr(s, 'auth_method', None),
                        "idle_seconds": (datetime.utcnow() - s.last_used).total_seconds(),
                        "query_count": s.query_count,
                        "created_at": s.created_at.isoformat(),
                        "last_used_at": s.last_used.isoformat(),
                    }
                    for sid, s in sorted_sessions
                ]
            }
    
    def shutdown(self):
        """Shutdown the session manager and close all connections."""
        self._running = False
        with self._lock:
            for session_id in list(self._sessions.keys()):
                self._remove_session_unsafe(session_id)


# Global session manager instance
session_manager = SessionManager(max_idle_minutes=30)
