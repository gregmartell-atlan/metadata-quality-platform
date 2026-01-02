"""
Application configuration using pydantic-settings.
Reads from environment variables with sensible defaults.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "Metadata Quality Platform"
    environment: str = "development"
    debug: bool = False

    # Atlan API (optional - can be passed from frontend)
    atlan_api_key: str | None = None
    atlan_base_url: str | None = None

    # Dapr configuration
    dapr_http_port: int = 3500
    dapr_grpc_port: int = 50001
    dapr_app_id: str = "metadata-quality-platform"

    # State store settings
    state_store_name: str = "statestore"
    object_store_name: str = "objectstore"

    # CORS settings
    cors_origins: str = "http://localhost:5173,http://localhost:8080"

    # Tenant (for multi-tenant deployments)
    atlan_tenant_id: str = "default"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
