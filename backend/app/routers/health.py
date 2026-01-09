"""
Health check endpoints for Kubernetes probes.
"""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str = "1.0.0"


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Basic health check endpoint.
    Used by Kubernetes liveness probe.
    """
    return HealthResponse(status="healthy")


@router.get("/ready", response_model=HealthResponse)
async def readiness_check():
    """
    Readiness check endpoint.
    Used by Kubernetes readiness probe.
    Could be extended to check Dapr sidecar, database connections, etc.
    """
    return HealthResponse(status="ready")
