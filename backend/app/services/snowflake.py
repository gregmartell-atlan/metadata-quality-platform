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
from .cache import query_cache, metadata_cache

logger = logging.getLogger(__name__)

# SQL identifier validation regex
import re
IDENTIFIER_REGEX = re.compile(r'^[A-Za-z_][A-Za-z0-9_$]*$')


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
    DEPRECATED: Use SessionManager from session.py instead.

    This class is deprecated due to race conditions (no locking).
    SessionManager provides thread-safe session management with:
    - RLock for thread safety
    - Background cleanup thread
    - 30-minute session expiry

    This class is kept for backward compatibility but will be removed in a future version.
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

    def _validate_identifier(self, name: str) -> str:
        """
        Validate SQL identifier to prevent injection.

        Raises ValueError if invalid.
        Returns uppercase identifier if valid.
        """
        if not name or not IDENTIFIER_REGEX.match(name):
            raise ValueError(f"Invalid SQL identifier: {name}")
        return name.upper()

    def execute_query_cached(
        self,
        query: str,
        params: dict[str, Any] | None = None,
        session_id: str | None = None,
        use_cache: bool = True,
    ) -> list[dict[str, Any]]:
        """
        Execute query with caching support.

        Args:
            query: SQL query to execute
            params: Query parameters
            session_id: Session to use
            use_cache: Whether to use query cache (default True)

        Returns:
            List of result rows as dictionaries
        """
        # Check cache first
        if use_cache:
            cached = query_cache.get(query, params)
            if cached is not None:
                logger.debug(f"Cache hit for query: {query[:50]}...")
                return cached

        # Execute query
        results = self.execute_query(query, params, session_id)

        # Cache results
        if use_cache:
            query_cache.set(query, params, results)

        return results

    def get_databases(
        self,
        session_id: str | None = None,
        use_cache: bool = True,
    ) -> list[str]:
        """
        Get list of accessible databases.

        Uses metadata cache when available.
        """
        settings = get_settings()
        account = settings.snowflake_account or "unknown"

        # Check cache
        if use_cache:
            cached = metadata_cache.get_databases(account)
            if cached is not None:
                logger.debug(f"Cache hit for databases")
                return cached

        # Query Snowflake
        query = "SHOW DATABASES"
        results = self.execute_query(query, session_id=session_id)

        databases = [row.get("name", row.get("NAME", "")) for row in results]
        databases = [d for d in databases if d]  # Filter empty

        # Cache
        if use_cache:
            metadata_cache.set_databases(account, databases)

        return databases

    def get_schemas(
        self,
        database: str,
        session_id: str | None = None,
        use_cache: bool = True,
    ) -> list[str]:
        """
        Get list of schemas in a database.

        Args:
            database: Database name
            session_id: Session to use
            use_cache: Whether to use cache

        Returns:
            List of schema names
        """
        settings = get_settings()
        account = settings.snowflake_account or "unknown"
        database = self._validate_identifier(database)

        # Check cache
        if use_cache:
            cached = metadata_cache.get_schemas(account, database)
            if cached is not None:
                logger.debug(f"Cache hit for schemas in {database}")
                return cached

        # Query Snowflake
        query = f'SHOW SCHEMAS IN DATABASE "{database}"'
        results = self.execute_query(query, session_id=session_id)

        schemas = [row.get("name", row.get("NAME", "")) for row in results]
        schemas = [s for s in schemas if s and s not in ("INFORMATION_SCHEMA",)]

        # Cache
        if use_cache:
            metadata_cache.set_schemas(account, database, schemas)

        return schemas

    def get_tables(
        self,
        database: str,
        schema: str,
        session_id: str | None = None,
        use_cache: bool = True,
        include_views: bool = True,
    ) -> list[dict[str, Any]]:
        """
        Get list of tables in a schema with metadata.

        Args:
            database: Database name
            schema: Schema name
            session_id: Session to use
            use_cache: Whether to use cache
            include_views: Include views in results

        Returns:
            List of table info dicts with name, type, rows, bytes
        """
        settings = get_settings()
        account = settings.snowflake_account or "unknown"
        database = self._validate_identifier(database)
        schema = self._validate_identifier(schema)

        # Check cache
        if use_cache:
            cached = metadata_cache.get_tables(account, database, schema)
            if cached is not None:
                logger.debug(f"Cache hit for tables in {database}.{schema}")
                return cached

        # Query Snowflake
        query = f'SHOW TABLES IN "{database}"."{schema}"'
        results = self.execute_query(query, session_id=session_id)

        tables = []
        for row in results:
            tables.append({
                "name": row.get("name", row.get("NAME", "")),
                "type": "TABLE",
                "rows": row.get("rows", row.get("ROWS", 0)),
                "bytes": row.get("bytes", row.get("BYTES", 0)),
            })

        # Also get views if requested
        if include_views:
            view_query = f'SHOW VIEWS IN "{database}"."{schema}"'
            try:
                view_results = self.execute_query(view_query, session_id=session_id)
                for row in view_results:
                    tables.append({
                        "name": row.get("name", row.get("NAME", "")),
                        "type": "VIEW",
                        "rows": 0,
                        "bytes": 0,
                    })
            except Exception as e:
                logger.warning(f"Could not fetch views: {e}")

        # Cache
        if use_cache:
            metadata_cache.set_tables(account, database, schema, tables)

        return tables

    def get_columns(
        self,
        database: str,
        schema: str,
        table: str,
        session_id: str | None = None,
        use_cache: bool = True,
    ) -> list[dict[str, Any]]:
        """
        Get list of columns in a table with metadata.

        Args:
            database: Database name
            schema: Schema name
            table: Table name
            session_id: Session to use
            use_cache: Whether to use cache

        Returns:
            List of column info dicts with name, type, nullable
        """
        settings = get_settings()
        account = settings.snowflake_account or "unknown"
        database = self._validate_identifier(database)
        schema = self._validate_identifier(schema)
        table = self._validate_identifier(table)

        # Check cache
        if use_cache:
            cached = metadata_cache.get_columns(account, database, schema, table)
            if cached is not None:
                logger.debug(f"Cache hit for columns in {database}.{schema}.{table}")
                return cached

        # Query using INFORMATION_SCHEMA for richer metadata
        query = f"""
        SELECT
            COLUMN_NAME,
            DATA_TYPE,
            IS_NULLABLE,
            COLUMN_DEFAULT,
            ORDINAL_POSITION,
            COMMENT
        FROM "{database}".INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
        ORDER BY ORDINAL_POSITION
        """
        results = self.execute_query(query, {"1": schema, "2": table}, session_id)

        columns = []
        for row in results:
            columns.append({
                "name": row.get("COLUMN_NAME", ""),
                "type": row.get("DATA_TYPE", ""),
                "nullable": row.get("IS_NULLABLE", "YES") == "YES",
                "default": row.get("COLUMN_DEFAULT"),
                "position": row.get("ORDINAL_POSITION", 0),
                "comment": row.get("COMMENT"),
            })

        # Cache
        if use_cache:
            metadata_cache.set_columns(account, database, schema, table, columns)

        return columns

    def get_table_preview(
        self,
        database: str,
        schema: str,
        table: str,
        limit: int = 100,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Get preview data from a table.

        Args:
            database: Database name
            schema: Schema name
            table: Table name
            limit: Max rows to return
            session_id: Session to use

        Returns:
            Dict with columns and rows
        """
        database = self._validate_identifier(database)
        schema = self._validate_identifier(schema)
        table = self._validate_identifier(table)
        limit = min(max(1, limit), 1000)  # Clamp to 1-1000

        # Get columns first
        columns = self.get_columns(database, schema, table, session_id)

        # Query data
        query = f'SELECT * FROM "{database}"."{schema}"."{table}" LIMIT {limit}'
        rows = self.execute_query(query, session_id=session_id)

        return {
            "columns": columns,
            "rows": rows,
            "total_rows": len(rows),
            "limit": limit,
        }

    def get_cache_stats(self) -> dict[str, Any]:
        """Get statistics for both query and metadata caches."""
        return {
            "query_cache": query_cache.get_stats(),
            "metadata_cache": metadata_cache.get_stats(),
        }

    def invalidate_cache(self, cache_type: str = "all") -> dict[str, Any]:
        """
        Invalidate caches.

        Args:
            cache_type: "query", "metadata", or "all"

        Returns:
            Summary of invalidation
        """
        result = {}

        if cache_type in ("query", "all"):
            count = query_cache.invalidate()
            result["query_entries_cleared"] = count

        if cache_type in ("metadata", "all"):
            metadata_cache.invalidate_all()
            result["metadata_cleared"] = True

        return result

    def close_all(self) -> None:
        """Close all active sessions."""
        for session_id, session in list(self._sessions.items()):
            session.close()
            del self._sessions[session_id]
        logger.info("All Snowflake sessions closed")


# Singleton instance (DEPRECATED)
_snowflake_service: SnowflakeService | None = None


def get_snowflake_service() -> SnowflakeService:
    """
    DEPRECATED: Use session_manager from session.py instead.

    This function is deprecated due to race conditions in SnowflakeService.
    Use SessionManager for thread-safe session management.

    Example:
        from .session import session_manager
        session = session_manager.get_session(session_id)
    """
    import warnings
    warnings.warn(
        "get_snowflake_service() is deprecated. Use session_manager from session.py instead.",
        DeprecationWarning,
        stacklevel=2
    )
    global _snowflake_service
    if _snowflake_service is None:
        _snowflake_service = SnowflakeService()
    return _snowflake_service
