"""
State Store Router - Dapr State Store Integration.
Provides REST API for persisting application state using Dapr sidecar.

When Dapr is not available, falls back to in-memory storage for development.
"""

import json
import logging
from datetime import datetime
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()

# In-memory fallback for when Dapr is not available
_memory_store: dict[str, Any] = {}

# Dapr sidecar base URL
DAPR_URL = f"http://localhost:{settings.dapr_http_port}"

# HTTP client for Dapr
dapr_client = httpx.AsyncClient(timeout=10.0)


class StateItem(BaseModel):
    """State item for save operations."""
    key: str
    value: Any


class SaveStateRequest(BaseModel):
    """Request body for saving state."""
    items: list[StateItem]


async def is_dapr_available() -> bool:
    """Check if Dapr sidecar is available."""
    try:
        response = await dapr_client.get(f"{DAPR_URL}/v1.0/healthz")
        return response.status_code == 204
    except Exception:
        return False


@router.get("/health")
async def state_store_health():
    """Check state store health and Dapr connectivity."""
    dapr_available = await is_dapr_available()
    return {
        "dapr_available": dapr_available,
        "storage_mode": "dapr" if dapr_available else "memory",
        "store_name": settings.state_store_name
    }


@router.get("/{key}")
async def get_state(key: str, tenant_id: str | None = None):
    """
    Get state by key.
    Uses Dapr state store if available, otherwise in-memory.
    """
    # Prefix key with tenant for multi-tenancy
    full_key = f"{tenant_id or settings.atlan_tenant_id}:{key}"

    if await is_dapr_available():
        try:
            response = await dapr_client.get(
                f"{DAPR_URL}/v1.0/state/{settings.state_store_name}/{full_key}"
            )
            if response.status_code == 204:
                return {"key": key, "value": None}
            return {"key": key, "value": response.json()}
        except Exception as e:
            logger.error(f"Dapr state get failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to retrieve state")
    else:
        # Fallback to memory
        value = _memory_store.get(full_key)
        return {"key": key, "value": value}


@router.post("")
async def save_state(request: SaveStateRequest, tenant_id: str | None = None):
    """
    Save state items.
    Uses Dapr state store if available, otherwise in-memory.
    """
    tenant = tenant_id or settings.atlan_tenant_id

    if await is_dapr_available():
        try:
            # Format for Dapr bulk save
            dapr_items = [
                {
                    "key": f"{tenant}:{item.key}",
                    "value": item.value
                }
                for item in request.items
            ]

            response = await dapr_client.post(
                f"{DAPR_URL}/v1.0/state/{settings.state_store_name}",
                json=dapr_items
            )

            if response.status_code not in [200, 201, 204]:
                raise HTTPException(status_code=500, detail="Failed to save state to Dapr")

            return {"saved": len(request.items), "storage": "dapr"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Dapr state save failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to save state")
    else:
        # Fallback to memory
        for item in request.items:
            full_key = f"{tenant}:{item.key}"
            _memory_store[full_key] = item.value

        return {"saved": len(request.items), "storage": "memory"}


@router.delete("/{key}")
async def delete_state(key: str, tenant_id: str | None = None):
    """
    Delete state by key.
    Uses Dapr state store if available, otherwise in-memory.
    """
    full_key = f"{tenant_id or settings.atlan_tenant_id}:{key}"

    if await is_dapr_available():
        try:
            response = await dapr_client.delete(
                f"{DAPR_URL}/v1.0/state/{settings.state_store_name}/{full_key}"
            )
            return {"deleted": key}
        except Exception as e:
            logger.error(f"Dapr state delete failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to delete state")
    else:
        # Fallback to memory
        _memory_store.pop(full_key, None)
        return {"deleted": key}


# ============================================================================
# Trend Data Endpoints (for historical quality data)
# ============================================================================

@router.get("/trends/daily")
async def get_daily_trends(days: int = 90, tenant_id: str | None = None):
    """Get daily aggregation trend data."""
    key = "daily_aggregations"
    result = await get_state(key, tenant_id)

    if not result["value"]:
        return {"aggregations": []}

    aggregations = result["value"]
    if isinstance(aggregations, list):
        # Filter to requested days
        cutoff = datetime.now().timestamp() * 1000 - (days * 24 * 60 * 60 * 1000)
        filtered = [a for a in aggregations if a.get("timestamp", 0) > cutoff]
        return {"aggregations": filtered}

    return {"aggregations": []}


@router.post("/trends/daily")
async def save_daily_aggregation(aggregation: dict, tenant_id: str | None = None):
    """Save a daily aggregation to trend data."""
    key = "daily_aggregations"
    result = await get_state(key, tenant_id)

    existing = result["value"] or []
    if not isinstance(existing, list):
        existing = []

    # Add new aggregation
    existing.append(aggregation)

    # Keep last 365 days
    if len(existing) > 365:
        existing = existing[-365:]

    # Save back
    await save_state(
        SaveStateRequest(items=[StateItem(key=key, value=existing)]),
        tenant_id
    )

    return {"saved": True, "total_aggregations": len(existing)}


@router.get("/session")
async def get_session(tenant_id: str | None = None):
    """Get session state for resume functionality."""
    result = await get_state("session", tenant_id)
    return {"session": result["value"]}


@router.post("/session")
async def save_session(session: dict, tenant_id: str | None = None):
    """Save session state for resume functionality."""
    session["lastActiveTimestamp"] = int(datetime.now().timestamp() * 1000)

    await save_state(
        SaveStateRequest(items=[StateItem(key="session", value=session)]),
        tenant_id
    )

    return {"saved": True}
