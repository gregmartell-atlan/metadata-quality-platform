"""
Backend services for the Metadata Quality Platform.
"""

from .snowflake import SnowflakeService, get_snowflake_service

__all__ = ["SnowflakeService", "get_snowflake_service"]
