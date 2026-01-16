"""
Snowflake connection router for MDLH integration.

Provides endpoints for:
- Unified connect endpoint (token/SSO)
- Session status checking
- Disconnect/logout
"""

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict
import snowflake.connector
from snowflake.connector.errors import DatabaseError, OperationalError, ProgrammingError
from datetime import datetime
import time
from collections import defaultdict
import threading
import logging

from ..services.session import session_manager
from ..config import get_settings

router = APIRouter(prefix="/snowflake", tags=["snowflake"])
logger = logging.getLogger(__name__)
settings = get_settings()


# =============================================================================
# Rate Limiting (Simple in-memory implementation)
# =============================================================================

class RateLimiter:
    """Simple in-memory rate limiter with sliding window."""
    
    def __init__(self, max_attempts: int = 5, window_seconds: int = 60):
        self._attempts: Dict[str, list] = defaultdict(list)
        self._lock = threading.Lock()
        self._max_attempts = max_attempts
        self._window_seconds = window_seconds
    
    def is_allowed(self, client_ip: str) -> tuple:
        now = time.time()
        with self._lock:
            self._attempts[client_ip] = [
                t for t in self._attempts[client_ip] 
                if now - t < self._window_seconds
            ]
            if len(self._attempts[client_ip]) >= self._max_attempts:
                oldest = self._attempts[client_ip][0]
                seconds_until_reset = int(self._window_seconds - (now - oldest)) + 1
                return False, seconds_until_reset
            self._attempts[client_ip].append(now)
            return True, 0


connect_rate_limiter = RateLimiter(max_attempts=5, window_seconds=60)


# =============================================================================
# Request/Response Models
# =============================================================================

class ConnectionRequest(BaseModel):
    """Connection request with credentials."""
    account: str
    user: str
    token: Optional[str] = None
    auth_type: str = "token"  # "token" or "sso"
    warehouse: str = "COMPUTE_WH"
    database: str = "ATLAN_GOLD"
    schema_name: str = "PUBLIC"
    role: Optional[str] = None


class ConnectionResponse(BaseModel):
    """Connection response with session ID."""
    connected: bool
    session_id: Optional[str] = None
    user: Optional[str] = None
    warehouse: Optional[str] = None
    database: Optional[str] = None
    role: Optional[str] = None
    error: Optional[str] = None


class SessionStatusResponse(BaseModel):
    """Session status response."""
    valid: bool
    user: Optional[str] = None
    warehouse: Optional[str] = None
    database: Optional[str] = None
    schema_name: Optional[str] = None
    role: Optional[str] = None
    query_count: Optional[int] = None
    idle_seconds: Optional[float] = None
    message: Optional[str] = None


class DisconnectResponse(BaseModel):
    """Disconnect response."""
    disconnected: bool
    message: str


class ConfigResponse(BaseModel):
    """Configuration response."""
    mdlh_enabled: bool = False
    data_backend: str = "api"
    snowflake_account: Optional[str] = None
    snowflake_warehouse: str = "COMPUTE_WH"
    snowflake_database: str = "ATLAN_GOLD"
    snowflake_schema: str = "PUBLIC"


# =============================================================================
# Helper Functions
# =============================================================================

def _get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/config", response_model=ConfigResponse)
async def get_config():
    """Get MDLH/Snowflake configuration for frontend."""
    return ConfigResponse(
        mdlh_enabled=getattr(settings, 'mdlh_enabled', False),
        data_backend=getattr(settings, 'data_backend', 'api'),
        snowflake_account=getattr(settings, 'snowflake_account', None),
        snowflake_warehouse=getattr(settings, 'snowflake_warehouse', 'COMPUTE_WH'),
        snowflake_database=getattr(settings, 'snowflake_database', 'ATLAN_GOLD'),
        snowflake_schema=getattr(settings, 'snowflake_schema', 'PUBLIC'),
    )


@router.post("/connect", response_model=ConnectionResponse)
async def connect(request: ConnectionRequest, http_request: Request):
    """
    Establish Snowflake connection and return session ID.
    Supports both token (PAT) and SSO authentication.
    """
    # Rate limiting check
    client_ip = _get_client_ip(http_request)
    allowed, retry_after = connect_rate_limiter.is_allowed(client_ip)
    
    if not allowed:
        logger.warning(f"[Connect] Rate limit exceeded for {client_ip}")
        return JSONResponse(
            status_code=429,
            content={
                "connected": False,
                "error": f"Too many connection attempts. Try again in {retry_after} seconds.",
            },
            headers={"Retry-After": str(retry_after)}
        )
    
    try:
        connect_params = {
            "account": request.account,
            "user": request.user,
            "warehouse": request.warehouse,
            "database": request.database,
            "schema": request.schema_name,
            "client_session_keep_alive": True,
            "network_timeout": 30,
        }
        
        if request.role:
            connect_params["role"] = request.role
        
        if request.auth_type == "sso":
            connect_params["authenticator"] = "externalbrowser"
        elif request.auth_type == "token":
            if not request.token:
                return ConnectionResponse(
                    connected=False,
                    error="Personal Access Token required"
                )
            connect_params["token"] = request.token
            connect_params["authenticator"] = "oauth"
        else:
            return ConnectionResponse(
                connected=False,
                error=f"Unknown auth_type: {request.auth_type}"
            )
        
        logger.info(f"[Connect] {request.auth_type} auth for {request.user}@{request.account}")
        conn = snowflake.connector.connect(**connect_params)
        
        # Verify connection and get actual user info
        cursor = conn.cursor()
        cursor.execute("SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE()")
        row = cursor.fetchone()
        cursor.close()
        
        # Create session
        session_id = session_manager.create_session(
            conn=conn,
            user=row[0],
            account=request.account,
            warehouse=row[2] or request.warehouse,
            database=request.database,
            schema=request.schema_name,
            role=row[1]
        )
        
        logger.info(f"[Connect] Session {session_id[:8]}... created for {row[0]}")
        
        return ConnectionResponse(
            connected=True,
            session_id=session_id,
            user=row[0],
            warehouse=row[2] or request.warehouse,
            database=request.database,
            role=row[1]
        )
        
    except DatabaseError as e:
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "password" in error_msg.lower() or "token" in error_msg.lower():
            logger.warning(f"[Connect] Auth failed: {e}")
            return JSONResponse(
                status_code=401,
                content={"connected": False, "error": "Authentication failed"}
            )
        logger.error(f"[Connect] Database error: {e}")
        return ConnectionResponse(connected=False, error=str(e))
    except (OperationalError, TimeoutError) as e:
        logger.error(f"[Connect] Network/timeout error: {e}")
        return JSONResponse(
            status_code=503,
            content={"connected": False, "error": "Snowflake connection timed out or unreachable"}
        )
    except Exception as e:
        logger.exception(f"[Connect] Unexpected error: {e}")
        return JSONResponse(
            status_code=500,
            content={"connected": False, "error": f"Internal error: {str(e)}"}
        )


@router.get("/session/status")
async def get_session_status(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Check if a session is still valid."""
    if not x_session_id:
        return JSONResponse(
            status_code=401,
            content={"valid": False, "reason": "NO_SESSION_ID", "message": "No session ID provided"}
        )
    
    session = session_manager.get_session(x_session_id)
    if session is None:
        return JSONResponse(
            status_code=401,
            content={"valid": False, "reason": "SESSION_NOT_FOUND", "message": "Session not found - please reconnect"}
        )
    
    # Verify connection is still alive
    try:
        cursor = session.conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
    except (DatabaseError, ProgrammingError) as e:
        error_msg = str(e).lower()
        if "authentication" in error_msg or "session" in error_msg or "token" in error_msg:
            session_manager.remove_session(x_session_id)
            return JSONResponse(
                status_code=401,
                content={"valid": False, "reason": "auth-error", "message": str(e)}
            )
        return JSONResponse(
            status_code=503,
            content={"valid": True, "reason": "snowflake-unreachable", "message": "Snowflake health check failed"}
        )
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"valid": True, "reason": "status-check-error", "message": str(e)}
        )
    
    idle = (datetime.utcnow() - session.last_used).total_seconds()
    
    return SessionStatusResponse(
        valid=True,
        user=session.user,
        warehouse=session.warehouse,
        database=session.database,
        schema_name=session.schema,
        role=session.role,
        query_count=session.query_count,
        idle_seconds=idle
    )


@router.post("/disconnect", response_model=DisconnectResponse)
async def disconnect(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Close session and release Snowflake connection."""
    if not x_session_id:
        return DisconnectResponse(disconnected=False, message="No session ID provided")
    
    removed = session_manager.remove_session(x_session_id)
    if removed:
        return DisconnectResponse(disconnected=True, message="Session closed")
    return DisconnectResponse(disconnected=False, message="Session not found")


@router.get("/sessions")
async def list_sessions():
    """List active sessions (for debugging)."""
    return session_manager.get_stats()


@router.get("/status")
async def connection_status(request: Request):
    """
    Get overall Snowflake connection status.
    Returns connection info if any session is active.
    Used by frontend to check MDLH availability.
    """
    stats = session_manager.get_stats()
    
    # Check if there's any active session
    if stats.get("active_sessions", 0) > 0:
        # Get the most recent session info
        sessions = stats.get("sessions", [])
        if sessions:
            session = sessions[0]  # Get first active session
            return {
                "connected": True,
                "user": session.get("user"),
                "auth_method": session.get("auth_method"),
                "session_id": session.get("session_id"),
                "created_at": session.get("created_at"),
                "last_used_at": session.get("last_used_at"),
            }
    
    return {
        "connected": False,
        "user": None,
        "auth_method": None,
        "session_id": None,
    }


@router.get("/health")
async def health():
    """Snowflake service health check."""
    stats = session_manager.get_stats()
    return {"status": "healthy", "active_sessions": stats["active_sessions"]}
