"""
Metadata Quality Platform - FastAPI Backend
Atlan App Framework compatible application.

Features:
- Static file serving for React frontend
- Atlan API proxy (handles CORS)
- Dapr state store for persistence
- Health endpoints for K8s probes
"""

import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import atlan_proxy, state_store, health

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info(f"Starting {settings.app_name}")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Dapr HTTP port: {settings.dapr_http_port}")
    yield
    logger.info(f"Shutting down {settings.app_name}")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="Data quality scoring and analysis platform for Atlan metadata",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
origins = [origin.strip() for origin in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(atlan_proxy.router, prefix="/api/atlan", tags=["Atlan API"])
app.include_router(state_store.router, prefix="/api/state", tags=["State Store"])

# Static files path (built React app)
STATIC_PATH = Path(__file__).parent / "static"


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


# Mount static files if they exist (production)
if STATIC_PATH.exists():
    # API routes are handled first, then static files
    app.mount("/assets", StaticFiles(directory=STATIC_PATH / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """
        Serve React SPA for all non-API routes.
        This enables client-side routing.
        """
        # Check if it's a file request
        file_path = STATIC_PATH / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)

        # Return index.html for SPA routing
        index_path = STATIC_PATH / "index.html"
        if index_path.exists():
            return FileResponse(index_path)

        raise HTTPException(status_code=404, detail="Not found")
else:
    logger.warning(f"Static files not found at {STATIC_PATH}")
    logger.warning("Running in API-only mode (for development)")

    @app.get("/")
    async def root():
        """Root endpoint when no static files are present."""
        return {
            "message": f"{settings.app_name} API",
            "version": "1.0.0",
            "docs": "/docs"
        }
