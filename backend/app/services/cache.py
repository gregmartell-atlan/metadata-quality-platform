"""
Caching layer for Snowflake MDLH queries.

Provides two cache types:
1. QueryResultCache - TTL + LRU cache for query results
2. MetadataCache - Tiered TTL cache for schema metadata (databases, schemas, tables, columns)

Adapted from Atlan_MDLH_Explorer with MQP integration.
"""

import hashlib
import json
import logging
import threading
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from collections import OrderedDict

logger = logging.getLogger(__name__)


class QueryResultCache:
    """
    TTL + LRU cache for query results.

    - Entries expire after TTL seconds
    - When max size reached, least recently used entries are evicted
    - Thread-safe with RLock
    """

    def __init__(self, maxsize: int = 1000, ttl_seconds: int = 300):
        self._cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._lock = threading.RLock()
        self._maxsize = maxsize
        self._ttl = timedelta(seconds=ttl_seconds)
        self._hits = 0
        self._misses = 0

    def _make_key(self, query: str, params: Optional[Dict] = None) -> str:
        """Create cache key from query and params."""
        key_data = query
        if params:
            key_data += json.dumps(params, sort_keys=True, default=str)
        return hashlib.sha256(key_data.encode()).hexdigest()[:16]

    def get(self, query: str, params: Optional[Dict] = None) -> Optional[List[Dict]]:
        """Get cached result if exists and not expired."""
        key = self._make_key(query, params)

        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return None

            entry = self._cache[key]

            # Check TTL
            if datetime.utcnow() - entry["cached_at"] > self._ttl:
                del self._cache[key]
                self._misses += 1
                return None

            # Move to end (most recently used)
            self._cache.move_to_end(key)
            self._hits += 1
            return entry["data"]

    def set(self, query: str, params: Optional[Dict], data: List[Dict]) -> None:
        """Cache query result."""
        key = self._make_key(query, params)

        with self._lock:
            # Evict if at capacity
            while len(self._cache) >= self._maxsize:
                self._cache.popitem(last=False)

            self._cache[key] = {
                "data": data,
                "cached_at": datetime.utcnow(),
                "query": query[:100],  # Truncate for debugging
            }

    def invalidate(self, query: str = None, params: Optional[Dict] = None) -> int:
        """
        Invalidate cache entries.

        If query is None, clears entire cache.
        If query provided, invalidates that specific entry.

        Returns number of entries invalidated.
        """
        with self._lock:
            if query is None:
                count = len(self._cache)
                self._cache.clear()
                return count

            key = self._make_key(query, params)
            if key in self._cache:
                del self._cache[key]
                return 1
            return 0

    def get_stats(self) -> Dict[str, Any]:
        """Return cache statistics."""
        with self._lock:
            total = self._hits + self._misses
            return {
                "size": len(self._cache),
                "maxsize": self._maxsize,
                "ttl_seconds": self._ttl.total_seconds(),
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": self._hits / total if total > 0 else 0,
            }


class MetadataCache:
    """
    Tiered TTL cache for schema metadata.

    Different TTLs for different object types:
    - Databases: 10 minutes (changes rarely)
    - Schemas: 5 minutes
    - Tables: 2 minutes
    - Columns: 2 minutes

    Thread-safe with RLock.
    """

    def __init__(
        self,
        ttl_databases: int = 600,
        ttl_schemas: int = 300,
        ttl_tables: int = 120,
        ttl_columns: int = 120,
    ):
        self._databases: Dict[str, Dict[str, Any]] = {}  # key: account
        self._schemas: Dict[str, Dict[str, Any]] = {}    # key: account/database
        self._tables: Dict[str, Dict[str, Any]] = {}     # key: account/database/schema
        self._columns: Dict[str, Dict[str, Any]] = {}    # key: account/database/schema/table

        self._ttl_databases = timedelta(seconds=ttl_databases)
        self._ttl_schemas = timedelta(seconds=ttl_schemas)
        self._ttl_tables = timedelta(seconds=ttl_tables)
        self._ttl_columns = timedelta(seconds=ttl_columns)

        self._lock = threading.RLock()

    def _is_expired(self, entry: Dict[str, Any], ttl: timedelta) -> bool:
        """Check if cache entry is expired."""
        if "cached_at" not in entry:
            return True
        return datetime.utcnow() - entry["cached_at"] > ttl

    # Databases
    def get_databases(self, account: str) -> Optional[List[str]]:
        """Get cached database list for account."""
        with self._lock:
            entry = self._databases.get(account)
            if entry and not self._is_expired(entry, self._ttl_databases):
                return entry["data"]
            return None

    def set_databases(self, account: str, databases: List[str]) -> None:
        """Cache database list for account."""
        with self._lock:
            self._databases[account] = {
                "data": databases,
                "cached_at": datetime.utcnow(),
            }

    # Schemas
    def get_schemas(self, account: str, database: str) -> Optional[List[str]]:
        """Get cached schema list for database."""
        key = f"{account}/{database}"
        with self._lock:
            entry = self._schemas.get(key)
            if entry and not self._is_expired(entry, self._ttl_schemas):
                return entry["data"]
            return None

    def set_schemas(self, account: str, database: str, schemas: List[str]) -> None:
        """Cache schema list for database."""
        key = f"{account}/{database}"
        with self._lock:
            self._schemas[key] = {
                "data": schemas,
                "cached_at": datetime.utcnow(),
            }

    # Tables
    def get_tables(self, account: str, database: str, schema: str) -> Optional[List[Dict]]:
        """Get cached table list for schema."""
        key = f"{account}/{database}/{schema}"
        with self._lock:
            entry = self._tables.get(key)
            if entry and not self._is_expired(entry, self._ttl_tables):
                return entry["data"]
            return None

    def set_tables(self, account: str, database: str, schema: str, tables: List[Dict]) -> None:
        """Cache table list for schema."""
        key = f"{account}/{database}/{schema}"
        with self._lock:
            self._tables[key] = {
                "data": tables,
                "cached_at": datetime.utcnow(),
            }

    # Columns
    def get_columns(self, account: str, database: str, schema: str, table: str) -> Optional[List[Dict]]:
        """Get cached column list for table."""
        key = f"{account}/{database}/{schema}/{table}"
        with self._lock:
            entry = self._columns.get(key)
            if entry and not self._is_expired(entry, self._ttl_columns):
                return entry["data"]
            return None

    def set_columns(
        self, account: str, database: str, schema: str, table: str, columns: List[Dict]
    ) -> None:
        """Cache column list for table."""
        key = f"{account}/{database}/{schema}/{table}"
        with self._lock:
            self._columns[key] = {
                "data": columns,
                "cached_at": datetime.utcnow(),
            }

    def invalidate_all(self) -> None:
        """Clear all cached metadata."""
        with self._lock:
            self._databases.clear()
            self._schemas.clear()
            self._tables.clear()
            self._columns.clear()

    def invalidate_database(self, account: str, database: str) -> None:
        """Invalidate all cached metadata for a database."""
        prefix = f"{account}/{database}"
        with self._lock:
            # Remove schemas for this database
            self._schemas = {k: v for k, v in self._schemas.items() if not k.startswith(prefix)}
            # Remove tables for this database
            self._tables = {k: v for k, v in self._tables.items() if not k.startswith(prefix)}
            # Remove columns for this database
            self._columns = {k: v for k, v in self._columns.items() if not k.startswith(prefix)}

    def get_stats(self) -> Dict[str, Any]:
        """Return cache statistics."""
        with self._lock:
            return {
                "databases": len(self._databases),
                "schemas": len(self._schemas),
                "tables": len(self._tables),
                "columns": len(self._columns),
                "ttl_databases": self._ttl_databases.total_seconds(),
                "ttl_schemas": self._ttl_schemas.total_seconds(),
                "ttl_tables": self._ttl_tables.total_seconds(),
                "ttl_columns": self._ttl_columns.total_seconds(),
            }


# Global instances
query_cache = QueryResultCache(maxsize=1000, ttl_seconds=300)
metadata_cache = MetadataCache()
