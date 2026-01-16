"""
Snowflake service for MDLH Gold Layer connectivity.

Supports two authentication methods:
1. SSO (externalbrowser) - Opens browser for user authentication
2. PAT (Private Key) - Programmatic access using key-pair authentication
"""

import logging
from typing import Any
from datetime import datetime, timedelta
from contextlib import contextmanager
from functools import lru_cache

import snowflake.connector
from snowflake.connector import SnowflakeConnection
from snowflake.connector.errors import ProgrammingError, DatabaseError

from ..config import get_settings

logger = logging.getLogger(__name__)


class SnowflakeSession:
    """Represents an active Snowflake session with metadata."""

    def __init__(
        self,
        connection: SnowflakeConnection,
        auth_method: str,
        user: str | None = None,
    ):
        self.connection = connection
        self.auth_method = auth_method  # "sso" or "pat"
        self.user = user
        self.created_at = datetime.utcnow()
        self.last_used_at = datetime.utcnow()

    @property
    def is_expired(self) -> bool:
        """Check if session has exceeded timeout."""
        settings = get_settings()
        timeout = timedelta(minutes=settings.snowflake_session_timeout_minutes)
        return datetime.utcnow() - self.last_used_at > timeout

    @property
    def is_connected(self) -> bool:
        """Check if the connection is still alive."""
        try:
            if self.connection is None:
                return False
            # Try a simple query to verify connection
            cursor = self.connection.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            return True
        except Exception:
            return False

    def touch(self) -> None:
        """Update last used timestamp."""
        self.last_used_at = datetime.utcnow()

    def close(self) -> None:
        """Close the connection."""
        if self.connection:
            try:
                self.connection.close()
            except Exception as e:
                logger.warning(f"Error closing Snowflake connection: {e}")
            finally:
                self.connection = None


class SnowflakeService:
    """
    Manages Snowflake connections for MDLH queries.

    This service maintains a session pool and handles both SSO and PAT
    authentication methods.
    """

    def __init__(self):
        self._sessions: dict[str, SnowflakeSession] = {}
        self._default_session_id = "default"

    def get_connection_params(self) -> dict[str, Any]:
        """Get base connection parameters from settings."""
        settings = get_settings()
        params = {
            "account": settings.snowflake_account,
            "warehouse": settings.snowflake_warehouse,
            "database": settings.snowflake_database,
            "schema": settings.snowflake_schema,
        }
        if settings.snowflake_role:
            params["role"] = settings.snowflake_role
        return params

    def connect_sso(
        self,
        account: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Initiate SSO authentication flow.

        This opens a browser window for the user to authenticate.
        The connection is stored in the session pool.

        Args:
            account: Snowflake account identifier (overrides config)
            session_id: Optional session identifier for multi-user scenarios

        Returns:
            Connection status and user info
        """
        settings = get_settings()
        session_id = session_id or self._default_session_id

        # Close existing session if any
        if session_id in self._sessions:
            self._sessions[session_id].close()
            del self._sessions[session_id]

        try:
            params = self.get_connection_params()
            if account:
                params["account"] = account

            # SSO authentication - opens browser
            params["authenticator"] = "externalbrowser"

            logger.info(f"Initiating SSO connection to Snowflake account: {params.get('account')}")

            connection = snowflake.connector.connect(**params)

            # Get user info from connection
            cursor = connection.cursor()
            cursor.execute("SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE()")
            row = cursor.fetchone()
            cursor.close()

            user = row[0] if row else None
            role = row[1] if row else None
            warehouse = row[2] if row else None

            # Store session
            session = SnowflakeSession(
                connection=connection,
                auth_method="sso",
                user=user,
            )
            self._sessions[session_id] = session

            logger.info(f"SSO connection established for user: {user}")

            return {
                "connected": True,
                "auth_method": "sso",
                "user": user,
                "role": role,
                "warehouse": warehouse,
                "database": settings.snowflake_database,
                "schema": settings.snowflake_schema,
                "session_id": session_id,
            }

        except Exception as e:
            logger.error(f"SSO connection failed: {e}")
            raise ConnectionError(f"Failed to connect via SSO: {str(e)}")

    def connect_pat(
        self,
        user: str | None = None,
        private_key_path: str | None = None,
        private_key_passphrase: str | None = None,
        account: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Connect using Private Key (PAT) authentication.

        Args:
            user: Snowflake username
            private_key_path: Path to private key file
            private_key_passphrase: Passphrase for private key
            account: Snowflake account (overrides config)
            session_id: Optional session identifier

        Returns:
            Connection status and user info
        """
        settings = get_settings()
        session_id = session_id or self._default_session_id

        # Use config values as defaults
        user = user or settings.snowflake_user
        private_key_path = private_key_path or settings.snowflake_private_key_path
        private_key_passphrase = private_key_passphrase or settings.snowflake_private_key_passphrase

        if not user or not private_key_path:
            raise ValueError("User and private_key_path are required for PAT authentication")

        # Close existing session if any
        if session_id in self._sessions:
            self._sessions[session_id].close()
            del self._sessions[session_id]

        try:
            # Read private key
            from cryptography.hazmat.backends import default_backend
            from cryptography.hazmat.primitives import serialization

            with open(private_key_path, "rb") as key_file:
                private_key = serialization.load_pem_private_key(
                    key_file.read(),
                    password=private_key_passphrase.encode() if private_key_passphrase else None,
                    backend=default_backend(),
                )

            # Get private key bytes
            private_key_bytes = private_key.private_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )

            params = self.get_connection_params()
            if account:
                params["account"] = account

            params["user"] = user
            params["private_key"] = private_key_bytes

            logger.info(f"Initiating PAT connection for user: {user}")

            connection = snowflake.connector.connect(**params)

            # Get connection info
            cursor = connection.cursor()
            cursor.execute("SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE()")
            row = cursor.fetchone()
            cursor.close()

            role = row[1] if row else None
            warehouse = row[2] if row else None

            # Store session
            session = SnowflakeSession(
                connection=connection,
                auth_method="pat",
                user=user,
            )
            self._sessions[session_id] = session

            logger.info(f"PAT connection established for user: {user}")

            return {
                "connected": True,
                "auth_method": "pat",
                "user": user,
                "role": role,
                "warehouse": warehouse,
                "database": settings.snowflake_database,
                "schema": settings.snowflake_schema,
                "session_id": session_id,
            }

        except FileNotFoundError:
            raise ValueError(f"Private key file not found: {private_key_path}")
        except Exception as e:
            logger.error(f"PAT connection failed: {e}")
            raise ConnectionError(f"Failed to connect via PAT: {str(e)}")

    def get_session(self, session_id: str | None = None) -> SnowflakeSession | None:
        """Get an active session by ID.
        
        If session_id is None, returns ANY active (non-expired, connected) session.
        This enables MDLH endpoints to work without requiring explicit session management.
        """
        # If no session_id provided, find any active session
        if session_id is None and self._sessions:
            for sid, session in list(self._sessions.items()):
                if session.is_expired:
                    logger.info(f"Session {sid} expired, closing")
                    session.close()
                    del self._sessions[sid]
                    continue
                if session.is_connected:
                    return session
            # No connected sessions found
            return None
        
        # Look for specific session
        session_id = session_id or self._default_session_id
        session = self._sessions.get(session_id)

        if session and session.is_expired:
            logger.info(f"Session {session_id} expired, closing")
            session.close()
            del self._sessions[session_id]
            return None

        return session

    def get_status(self, session_id: str | None = None) -> dict[str, Any]:
        """Get connection status for a session.
        
        If session_id is None, returns status for ANY active session.
        This allows MDLH endpoints to work without requiring a specific session ID.
        """
        # If no session_id provided, try to find any active session
        if session_id is None and self._sessions:
            # Return status of first active session found
            for sid, session in list(self._sessions.items()):
                if session.is_expired:
                    session.close()
                    del self._sessions[sid]
                    continue
                if session.is_connected:
                    return {
                        "connected": True,
                        "auth_method": session.auth_method,
                        "user": session.user,
                        "created_at": session.created_at.isoformat(),
                        "last_used_at": session.last_used_at.isoformat(),
                        "session_id": sid,
                    }
        
        # Try specific session
        session = self.get_session(session_id)

        if not session:
            return {
                "connected": False,
                "session_id": session_id or self._default_session_id,
            }

        return {
            "connected": session.is_connected,
            "auth_method": session.auth_method,
            "user": session.user,
            "created_at": session.created_at.isoformat(),
            "last_used_at": session.last_used_at.isoformat(),
            "session_id": session_id or self._default_session_id,
        }

    def disconnect(self, session_id: str | None = None) -> dict[str, Any]:
        """Disconnect a session."""
        session_id = session_id or self._default_session_id
        session = self._sessions.get(session_id)

        if session:
            session.close()
            del self._sessions[session_id]
            logger.info(f"Session {session_id} disconnected")
            return {"disconnected": True, "session_id": session_id}

        return {"disconnected": False, "session_id": session_id, "message": "No active session"}

    def execute_query(
        self,
        query: str,
        params: dict[str, Any] | None = None,
        session_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Execute a query and return results as a list of dictionaries.

        Args:
            query: SQL query to execute
            params: Optional query parameters
            session_id: Session to use

        Returns:
            List of result rows as dictionaries
        """
        session = self.get_session(session_id)
        if not session or not session.is_connected:
            raise ConnectionError("No active Snowflake connection")

        session.touch()

        try:
            cursor = session.connection.cursor()

            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)

            # Get column names
            columns = [desc[0] for desc in cursor.description] if cursor.description else []

            # Fetch all results
            rows = cursor.fetchall()
            cursor.close()

            # Convert to list of dicts
            results = []
            for row in rows:
                row_dict = {}
                for i, col in enumerate(columns):
                    value = row[i]
                    # Handle special types
                    if isinstance(value, datetime):
                        value = value.isoformat()
                    row_dict[col] = value
                results.append(row_dict)

            return results

        except ProgrammingError as e:
            logger.error(f"Query error: {e}")
            raise ValueError(f"Query execution failed: {str(e)}")
        except DatabaseError as e:
            logger.error(f"Database error: {e}")
            raise ConnectionError(f"Database error: {str(e)}")

    def execute_query_single(
        self,
        query: str,
        params: dict[str, Any] | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any] | None:
        """Execute a query and return a single result row."""
        results = self.execute_query(query, params, session_id)
        return results[0] if results else None

    @contextmanager
    def cursor(self, session_id: str | None = None):
        """Context manager for cursor access."""
        session = self.get_session(session_id)
        if not session or not session.is_connected:
            raise ConnectionError("No active Snowflake connection")

        session.touch()
        cursor = session.connection.cursor()
        try:
            yield cursor
        finally:
            cursor.close()

    def close_all(self) -> None:
        """Close all active sessions."""
        for session_id, session in list(self._sessions.items()):
            session.close()
            del self._sessions[session_id]
        logger.info("All Snowflake sessions closed")


# Singleton instance
_snowflake_service: SnowflakeService | None = None


def get_snowflake_service() -> SnowflakeService:
    """Get the singleton Snowflake service instance."""
    global _snowflake_service
    if _snowflake_service is None:
        _snowflake_service = SnowflakeService()
    return _snowflake_service
