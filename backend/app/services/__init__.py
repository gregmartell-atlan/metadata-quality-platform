"""
Backend services for the Metadata Quality Platform.
"""

# Primary session management (thread-safe, recommended)
from .session import session_manager, SessionManager, SnowflakeSession

# DEPRECATED: SnowflakeService has race conditions - use session_manager instead
from .snowflake import SnowflakeService, get_snowflake_service

__all__ = [
    # Recommended
    "session_manager",
    "SessionManager",
    "SnowflakeSession",
    # Deprecated
    "SnowflakeService",
    "get_snowflake_service",
]
