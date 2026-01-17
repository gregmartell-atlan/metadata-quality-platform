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

    # CORS settings - include range of Vite dev server ports
    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177,http://localhost:5178,http://localhost:8080,http://localhost:3000"

    # Tenant (for multi-tenant deployments)
    atlan_tenant_id: str = "default"

    # ========================================
    # MDLH / Snowflake Configuration
    # ========================================

    # Data backend selection: "api" | "mdlh" | "hybrid"
    # - api: Use Atlan REST API for all operations
    # - mdlh: Use Snowflake MDLH for read operations
    # - hybrid: Use MDLH for bulk reads, API for writes
    data_backend: str = "api"

    # MDLH feature toggle
    mdlh_enabled: bool = False

    # Snowflake connection settings
    snowflake_account: str | None = None  # e.g., "xyz12345.us-east-1"
    snowflake_warehouse: str = "atlan-wh"
    snowflake_database: str = "ATLAN_GOLD"
    snowflake_schema: str = "PUBLIC"
    snowflake_role: str | None = None  # Optional role to assume

    # Snowflake authentication (PAT-based, for non-SSO scenarios)
    snowflake_user: str | None = None
    snowflake_private_key_path: str | None = None
    snowflake_private_key_passphrase: str | None = None

    # MDLH Polaris/Iceberg catalog settings (for PyIceberg integration)
    mdlh_catalog_uri: str | None = None
    mdlh_client_id: str | None = None
    mdlh_client_secret: str | None = None
    mdlh_scope: str = "PRINCIPAL_ROLE:lake_readers"

    # Session settings
    snowflake_session_timeout_minutes: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
