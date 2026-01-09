"""
Atlan API Proxy Router.
Forwards requests to Atlan API, handling authentication and CORS.

Supports two authentication modes:
1. Server-side: Uses ATLAN_API_KEY and ATLAN_BASE_URL from environment
2. Client-side: Uses x-atlan-api-key and x-atlan-url headers from request
"""

import logging
from typing import Any

import httpx
from fastapi import APIRouter, Request, HTTPException, Header
from fastapi.responses import Response

from ..config import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()

# Reusable HTTP client
http_client = httpx.AsyncClient(timeout=60.0)


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_atlan_request(
    request: Request,
    path: str,
    x_atlan_url: str | None = Header(None),
    x_atlan_api_key: str | None = Header(None),
):
    """
    Proxy requests to Atlan API.

    Accepts either:
    - Environment variables (ATLAN_BASE_URL, ATLAN_API_KEY) for server-side auth
    - Request headers (x-atlan-url, x-atlan-api-key) for client-side auth
    """
    # Determine Atlan base URL
    base_url = x_atlan_url or settings.atlan_base_url
    if not base_url:
        raise HTTPException(
            status_code=400,
            detail="Atlan URL not configured. Set ATLAN_BASE_URL or provide x-atlan-url header."
        )

    # Determine API key
    api_key = x_atlan_api_key or settings.atlan_api_key
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Atlan API key not configured. Set ATLAN_API_KEY or provide x-atlan-api-key header."
        )

    # Clean up base URL
    base_url = base_url.rstrip("/")

    # Build target URL
    target_url = f"{base_url}/api/{path}"

    # Prepare headers for Atlan
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Get request body if present
    body = None
    if request.method in ["POST", "PUT", "PATCH"]:
        body = await request.body()

    # Forward query parameters
    query_params = dict(request.query_params)

    logger.info(f"Proxying {request.method} to {target_url}")

    try:
        # Make request to Atlan
        response = await http_client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body,
            params=query_params,
        )

        # Return response with original status and headers
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers={
                "Content-Type": response.headers.get("Content-Type", "application/json"),
            },
        )

    except httpx.TimeoutException:
        logger.error(f"Timeout proxying request to {target_url}")
        raise HTTPException(status_code=504, detail="Request to Atlan API timed out")

    except httpx.RequestError as e:
        logger.error(f"Error proxying request to {target_url}: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to connect to Atlan API: {str(e)}")
