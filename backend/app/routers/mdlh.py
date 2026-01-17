"""
MDLH Query Router for Metadata Lakehouse Gold Layer.

Provides endpoints for:
- Asset search and retrieval
- Quality score calculation
- Quality rollups by dimension
- Lineage traversal
- Pivot data aggregation
"""

import json
import logging
from enum import Enum
from typing import Any
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends, Query, Header, Request
from pydantic import BaseModel, Field

from ..services.session import session_manager, SnowflakeSession
from ..config import get_settings

logger = logging.getLogger(__name__)


# ============================================
# Error Handling
# ============================================


class SessionExpiredError(Exception):
    """Raised when a Snowflake session has expired or connection is lost."""
    pass


def handle_mdlh_errors(func):
    """
    Decorator for consistent error handling across MDLH endpoints.

    Converts common Snowflake errors into appropriate HTTP responses:
    - Warehouse suspended → 503 with resume instructions
    - Connection lost → 503 with reconnect instructions
    - Other errors → 500 with error details
    """
    from functools import wraps

    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            raise  # Re-raise HTTP exceptions as-is
        except SessionExpiredError as e:
            logger.warning(f"Session expired: {e}")
            raise HTTPException(
                status_code=503,
                detail="Snowflake session expired. Please reconnect via /api/snowflake/connect."
            )
        except Exception as e:
            error_msg = str(e).lower()

            # Handle warehouse suspended
            if "no active warehouse" in error_msg or "warehouse" in error_msg and "suspend" in error_msg:
                logger.warning(f"Warehouse suspended: {e}")
                raise HTTPException(
                    status_code=503,
                    detail="Snowflake warehouse is suspended. Resume it in Snowflake or wait for auto-resume."
                )

            # Handle connection issues
            if any(pattern in error_msg for pattern in ["session", "connection", "network", "socket", "timeout"]):
                logger.warning(f"Connection issue: {e}")
                raise HTTPException(
                    status_code=503,
                    detail="Snowflake connection lost. Please reconnect via /api/snowflake/connect."
                )

            # Handle authentication issues
            if "authentication" in error_msg or "unauthorized" in error_msg:
                logger.warning(f"Authentication issue: {e}")
                raise HTTPException(
                    status_code=401,
                    detail="Snowflake authentication failed. Please reconnect."
                )

            # Generic error
            logger.exception(f"MDLH query failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Query failed: {str(e)}"
            )

    return wrapper


def parse_json_array(value: Any) -> list | None:
    """Parse a JSON array string into a Python list.

    Snowflake returns ARRAY columns as JSON strings, so we need to parse them.
    This function handles various edge cases to prevent Pydantic validation errors:
    - None → None
    - [] or ["a", "b"] → returns as-is
    - '["a", "b"]' (JSON string) → parsed list
    - "plain string" → None (not a valid array)
    - 123 (number) → None (not a valid array)
    - {} (dict) → None (not a valid array)
    """
    if value is None:
        return None
    if isinstance(value, list):
        # Already a list, return as-is (handles empty lists too)
        return value
    if isinstance(value, str):
        # Empty string
        if not value.strip():
            return None
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return parsed
            # JSON parsed but not a list (could be object, string, number)
            # Don't wrap in list - return None as it's not an array
            return None
        except (json.JSONDecodeError, TypeError, ValueError):
            # Not valid JSON - return None instead of failing
            return None
    # For any other type (int, float, dict, etc.), return None
    return None


def safe_parse_array(value: Any) -> list:
    """Parse array value with fallback to empty list.

    Use this when you need a list and never None (for Pydantic fields that
    default to empty list instead of None).
    """
    result = parse_json_array(value)
    return result if result is not None else []

router = APIRouter(prefix="/mdlh", tags=["mdlh"])


# ============================================
# Enums and Constants
# ============================================


class AssetType(str, Enum):
    """Supported asset types for filtering."""

    TABLE = "Table"
    VIEW = "View"
    MATERIALIZED_VIEW = "MaterializedView"
    COLUMN = "Column"
    DATABASE = "Database"
    SCHEMA = "Schema"
    ALL = "all"


class PivotDimension(str, Enum):
    """Dimensions for pivot aggregation."""

    CONNECTOR = "connector"
    DATABASE = "database"
    SCHEMA = "schema"
    ASSET_TYPE = "asset_type"
    CERTIFICATE_STATUS = "certificate_status"
    OWNER = "owner"  # Requires LATERAL FLATTEN for array handling


class LineageDirection(str, Enum):
    """Lineage traversal direction."""

    UPSTREAM = "UPSTREAM"
    DOWNSTREAM = "DOWNSTREAM"
    BOTH = "BOTH"


# ============================================
# SQL Templates
# ============================================


# Load SQL templates from files or define inline
# ============================================
# ALIGNED with client-side qualityMetrics.ts scoring logic:
# - Completeness: 8 checks (description, owner, certificate, tags, terms, readme, domain, lineage)
# - Accuracy: 5 checks (valid naming, has owner, has certificate+recency, has tags, not AI)
# - Timeliness: binary (any timestamp within 90 days)
# - Consistency: 4 checks (domain+terms, tags, hierarchy, connection)
# - Usability: 4 checks (popularity/view, consumption, usage, discoverable)
# ============================================
SQL_QUALITY_SCORES = """
SELECT
    -- ==========================================================================
    -- CORE ASSET FIELDS (ALL fields from ASSETS view)
    -- ==========================================================================
    A.GUID,
    A.ASSET_NAME,
    A.ASSET_TYPE,
    A.ASSET_QUALIFIED_NAME,
    A.DESCRIPTION,
    A.README_GUID,
    A.STATUS,
    -- Lifecycle timestamps
    A.CREATED_AT,
    A.CREATED_BY,
    A.UPDATED_AT,
    A.UPDATED_BY,
    -- Certificate fields
    A.CERTIFICATE_STATUS,
    A.CERTIFICATE_UPDATED_BY,
    A.CERTIFICATE_UPDATED_AT,
    -- Connector fields
    A.CONNECTOR_NAME,
    A.CONNECTOR_QUALIFIED_NAME,
    -- Source system timestamps
    A.SOURCE_CREATED_AT,
    A.SOURCE_CREATED_BY,
    A.SOURCE_UPDATED_AT,
    A.SOURCE_UPDATED_BY,
    -- Ownership and classification
    A.OWNER_USERS,
    A.TERM_GUIDS,
    A.TAGS,
    -- Metrics
    A.POPULARITY_SCORE,
    A.HAS_LINEAGE,

    -- =========================================================================
    -- COMPLETENESS SCORE (8 checks, aligned with client-side scoreCompleteness)
    -- Checks: description, owner, certificate, tags, terms, readme, domain*, lineage
    -- *Note: DOMAIN_GUIDS not in MDLH, using TERM_GUIDS as domain proxy is not accurate
    -- =========================================================================
    (CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 ELSE 0 END +
     CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_STATUS != '' THEN 1 ELSE 0 END +
     CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END +
     0 +  -- DOMAIN_GUIDS not available in MDLH Gold Layer
     CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END
    ) / 8.0 * 100 AS completeness_score,

    -- =========================================================================
    -- ACCURACY SCORE (5 checks, aligned with client-side scoreAccuracy)
    -- Checks: valid naming (regex), has owner, has certificate, has tags, not AI
    -- =========================================================================
    (CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[\\w\\-\\.]+$') THEN 1 ELSE 0 END +
     CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_STATUS != '' THEN 1 ELSE 0 END +
     CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
     1  -- Not AI generated (default - not tracked in MDLH)
    ) / 5.0 * 100 AS accuracy_score,

    -- =========================================================================
    -- TIMELINESS SCORE (binary: 100 if ANY timestamp within 90 days, else 0)
    -- Aligned with client-side scoreTimeliness which checks multiple clocks
    -- Now includes CERTIFICATE_UPDATED_AT which EXISTS in MDLH schema
    -- =========================================================================
    CASE WHEN (
        DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
        DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
        DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.CERTIFICATE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90
    ) THEN 100 ELSE 0 END AS timeliness_score,
    
    -- =========================================================================
    -- CONSISTENCY SCORE (4 checks, aligned with client-side scoreConsistency)
    -- Checks: domain+terms alignment, tags, hierarchy (db/schema), connection
    -- =========================================================================
    (CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +  -- terms (domain proxy)
     CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 2 THEN 1 ELSE 0 END +  -- has db/schema path
     CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END
    ) / 4.0 * 100 AS consistency_score,
    
    -- =========================================================================
    -- USABILITY SCORE (3 checks - TABLE_TOTAL_QUERY_COUNT not in official schema)
    -- Checks: popularity/viewScore, consumption (read count), discoverable
    -- =========================================================================
    (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
     1  -- Discoverable (default - all MDLH assets are discoverable)
    ) / 3.0 * 100 AS usability_score

FROM ATLAN_GOLD.PUBLIC.ASSETS A
LEFT JOIN ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS R ON A.GUID = R.GUID
WHERE A.STATUS = 'ACTIVE'
"""


SQL_QUALITY_ROLLUP = """
SELECT
    {dimension} AS dimension_value,
    COUNT(*) AS total_assets,
    
    -- Coverage metrics
    AVG(CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_description,
    AVG(CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_owner,
    AVG(CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_tags,
    AVG(CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1.0 ELSE 0.0 END) * 100 AS pct_certified,
    AVG(CASE WHEN A.HAS_LINEAGE = TRUE THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_lineage,
    AVG(CASE WHEN A.README_GUID IS NOT NULL THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_readme,
    AVG(CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_terms,
    
    -- =========================================================================
    -- Quality scores (ALIGNED with client-side qualityMetrics.ts)
    -- =========================================================================
    
    -- Completeness (8 checks: description, owner, certificate, tags, terms, readme, domain*, lineage)
    AVG(
        (CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 ELSE 0 END +
         CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_STATUS != '' THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END +
         0 +  -- DOMAIN_GUIDS not available
         CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END
        ) / 8.0 * 100
    ) AS avg_completeness,
    
    -- Accuracy (5 checks: valid naming, has owner, has certificate, has tags, not AI)
    AVG(
        (CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[\\w\\-\\.]+$') THEN 1 ELSE 0 END +
         CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_STATUS != '' THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         1  -- Not AI generated (default)
        ) / 5.0 * 100
    ) AS avg_accuracy,

    -- Timeliness (binary: any timestamp within 90 days)
    -- Note: CERTIFICATE_UPDATED_AT is available in MDLH schema (DDL line 18)
    AVG(
        CASE WHEN (
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.CERTIFICATE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90
        ) THEN 100.0 ELSE 0.0 END
    ) AS avg_timeliness,
    
    -- Consistency (4 checks: terms, tags, hierarchy, connection)
    AVG(
        (CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 2 THEN 1 ELSE 0 END +
         CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END
        ) / 4.0 * 100
    ) AS avg_consistency,
    
    -- Usability (3 checks - TABLE_TOTAL_QUERY_COUNT not in official schema)
    AVG(
        (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
         CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
         1  -- Discoverable (default)
        ) / 3.0 * 100
    ) AS avg_usability

FROM ATLAN_GOLD.PUBLIC.ASSETS A
LEFT JOIN ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS R ON A.GUID = R.GUID
WHERE A.STATUS = 'ACTIVE'
{asset_type_filter}
GROUP BY {dimension}
ORDER BY total_assets DESC
"""


SQL_LINEAGE = """
SELECT
    DIRECTION,
    START_GUID,
    START_NAME,
    START_TYPE,
    RELATED_GUID,
    RELATED_NAME,
    RELATED_TYPE,
    CONNECTING_GUID,
    LEVEL
FROM ATLAN_GOLD.PUBLIC.LINEAGE
WHERE START_GUID = %(guid)s
{direction_filter}
{level_filter}
ORDER BY LEVEL ASC
"""


SQL_SEARCH_ASSETS = """
SELECT
    -- ==========================================================================
    -- ALL ASSETS FIELDS (25 columns from MDLH Gold Layer ASSETS view)
    -- ==========================================================================
    A.GUID,
    A.ASSET_NAME,
    A.ASSET_TYPE,
    A.ASSET_QUALIFIED_NAME,
    A.DESCRIPTION,
    A.README_GUID,
    A.STATUS,
    -- Lifecycle timestamps
    A.CREATED_AT,
    A.CREATED_BY,
    A.UPDATED_AT,
    A.UPDATED_BY,
    -- Certificate fields
    A.CERTIFICATE_STATUS,
    A.CERTIFICATE_UPDATED_BY,
    A.CERTIFICATE_UPDATED_AT,
    -- Connector fields
    A.CONNECTOR_NAME,
    A.CONNECTOR_QUALIFIED_NAME,
    -- Source system timestamps
    A.SOURCE_CREATED_AT,
    A.SOURCE_CREATED_BY,
    A.SOURCE_UPDATED_AT,
    A.SOURCE_UPDATED_BY,
    -- Ownership and classification
    A.OWNER_USERS,
    A.TERM_GUIDS,
    A.TAGS,
    -- Metrics
    A.POPULARITY_SCORE,
    A.HAS_LINEAGE
FROM ATLAN_GOLD.PUBLIC.ASSETS A
WHERE A.STATUS = 'ACTIVE'
{type_filter}
{connector_filter}
{search_filter}
ORDER BY A.POPULARITY_SCORE DESC NULLS LAST, A.UPDATED_AT DESC
LIMIT {limit}
OFFSET {offset}
"""


SQL_ASSET_COUNT = """
SELECT COUNT(*) as total_count
FROM ATLAN_GOLD.PUBLIC.ASSETS A
WHERE A.STATUS = 'ACTIVE'
{type_filter}
{connector_filter}
"""


SQL_CONNECTORS = """
SELECT 
    CONNECTOR_NAME,
    COUNT(*) as asset_count
FROM ATLAN_GOLD.PUBLIC.ASSETS
WHERE STATUS = 'ACTIVE' AND CONNECTOR_NAME IS NOT NULL
GROUP BY CONNECTOR_NAME
ORDER BY asset_count DESC
"""


SQL_DATABASES = """
SELECT DISTINCT
    SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 4) as database_name,
    CONNECTOR_NAME,
    COUNT(*) as asset_count
FROM ATLAN_GOLD.PUBLIC.ASSETS
WHERE STATUS = 'ACTIVE'
    AND UPPER(ASSET_TYPE) IN ('DATABASE', 'TABLE', 'VIEW', 'SCHEMA')
    AND ASSET_QUALIFIED_NAME IS NOT NULL
GROUP BY SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 4), CONNECTOR_NAME
ORDER BY asset_count DESC
"""


# ============================================
# LINEAGE METRICS SQL - Provides upstream/downstream breakdown
# ============================================

SQL_LINEAGE_METRICS = """
WITH lineage_breakdown AS (
    SELECT
        L.START_GUID AS guid,
        MAX(CASE WHEN L.DIRECTION = 'UPSTREAM' THEN 1 ELSE 0 END) AS has_upstream,
        MAX(CASE WHEN L.DIRECTION = 'DOWNSTREAM' THEN 1 ELSE 0 END) AS has_downstream,
        COUNT(DISTINCT CASE WHEN L.DIRECTION = 'UPSTREAM' THEN L.RELATED_GUID END) AS upstream_count,
        COUNT(DISTINCT CASE WHEN L.DIRECTION = 'DOWNSTREAM' THEN L.RELATED_GUID END) AS downstream_count
    FROM ATLAN_GOLD.PUBLIC.LINEAGE L
    GROUP BY L.START_GUID
)
SELECT
    A.GUID,
    A.ASSET_NAME,
    A.ASSET_TYPE,
    A.CONNECTOR_NAME,
    COALESCE(LB.has_upstream, 0) AS has_upstream,
    COALESCE(LB.has_downstream, 0) AS has_downstream,
    CASE WHEN COALESCE(LB.has_upstream, 0) = 1 OR COALESCE(LB.has_downstream, 0) = 1
         THEN 1 ELSE 0 END AS has_lineage,
    CASE WHEN COALESCE(LB.has_upstream, 0) = 1 AND COALESCE(LB.has_downstream, 0) = 1
         THEN 1 ELSE 0 END AS full_lineage,
    CASE WHEN COALESCE(LB.has_upstream, 0) = 0 AND COALESCE(LB.has_downstream, 0) = 0
         THEN 1 ELSE 0 END AS orphaned,
    COALESCE(LB.upstream_count, 0) AS upstream_count,
    COALESCE(LB.downstream_count, 0) AS downstream_count
FROM ATLAN_GOLD.PUBLIC.ASSETS A
LEFT JOIN lineage_breakdown LB ON A.GUID = LB.guid
WHERE A.STATUS = 'ACTIVE'
{type_filter}
{connector_filter}
"""


SQL_LINEAGE_ROLLUP = """
WITH lineage_breakdown AS (
    SELECT
        L.START_GUID AS guid,
        MAX(CASE WHEN L.DIRECTION = 'UPSTREAM' THEN 1 ELSE 0 END) AS has_upstream,
        MAX(CASE WHEN L.DIRECTION = 'DOWNSTREAM' THEN 1 ELSE 0 END) AS has_downstream
    FROM ATLAN_GOLD.PUBLIC.LINEAGE L
    GROUP BY L.START_GUID
)
SELECT
    {dimension} AS dimension_value,
    COUNT(*) AS total_assets,
    AVG(COALESCE(LB.has_upstream, 0)) * 100 AS pct_has_upstream,
    AVG(COALESCE(LB.has_downstream, 0)) * 100 AS pct_has_downstream,
    AVG(CASE WHEN COALESCE(LB.has_upstream, 0) = 1 OR COALESCE(LB.has_downstream, 0) = 1
             THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_lineage,
    AVG(CASE WHEN COALESCE(LB.has_upstream, 0) = 1 AND COALESCE(LB.has_downstream, 0) = 1
             THEN 1.0 ELSE 0.0 END) * 100 AS pct_full_lineage,
    AVG(CASE WHEN COALESCE(LB.has_upstream, 0) = 0 AND COALESCE(LB.has_downstream, 0) = 0
             THEN 1.0 ELSE 0.0 END) * 100 AS pct_orphaned
FROM ATLAN_GOLD.PUBLIC.ASSETS A
LEFT JOIN lineage_breakdown LB ON A.GUID = LB.guid
WHERE A.STATUS = 'ACTIVE'
{asset_type_filter}
GROUP BY {dimension}
ORDER BY total_assets DESC
"""


# ============================================
# OWNER PIVOT SQL - Uses LATERAL FLATTEN for array handling
# ============================================

SQL_QUALITY_ROLLUP_BY_OWNER = """
SELECT
    COALESCE(owner.VALUE::STRING, 'Unowned') AS dimension_value,
    COUNT(DISTINCT A.GUID) AS total_assets,

    -- Coverage metrics
    AVG(CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_description,
    AVG(CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_tags,
    AVG(CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1.0 ELSE 0.0 END) * 100 AS pct_certified,
    AVG(CASE WHEN A.HAS_LINEAGE = TRUE THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_lineage,
    AVG(CASE WHEN A.README_GUID IS NOT NULL THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_readme,
    AVG(CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_terms,

    -- Completeness (8 checks)
    AVG(
        (CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 ELSE 0 END +
         CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_STATUS != '' THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END +
         0 +
         CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END
        ) / 8.0 * 100
    ) AS avg_completeness,

    -- Accuracy (5 checks: valid naming, has owner, has certificate, has tags, not AI)
    AVG(
        (CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[\\w\\-\\.]+$') THEN 1 ELSE 0 END +
         CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_STATUS != '' THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         1
        ) / 5.0 * 100
    ) AS avg_accuracy,

    -- Timeliness (includes CERTIFICATE_UPDATED_AT which is available in MDLH schema)
    AVG(
        CASE WHEN (
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.CERTIFICATE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90
        ) THEN 100.0 ELSE 0.0 END
    ) AS avg_timeliness,

    -- Consistency (4 checks)
    AVG(
        (CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 2 THEN 1 ELSE 0 END +
         CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END
        ) / 4.0 * 100
    ) AS avg_consistency,

    -- Usability (3 checks)
    AVG(
        (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
         CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
         1
        ) / 3.0 * 100
    ) AS avg_usability

FROM ATLAN_GOLD.PUBLIC.ASSETS A
LEFT JOIN ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS R ON A.GUID = R.GUID,
LATERAL FLATTEN(input => COALESCE(A.OWNER_USERS, ARRAY_CONSTRUCT(NULL)), outer => true) AS owner
WHERE A.STATUS = 'ACTIVE'
{asset_type_filter}
GROUP BY COALESCE(owner.VALUE::STRING, 'Unowned')
ORDER BY total_assets DESC
"""


# ============================================
# TIME SERIES / TRENDS SQL
# ============================================

SQL_QUALITY_SNAPSHOT = """
SELECT
    CURRENT_DATE() AS snapshot_date,
    CURRENT_TIMESTAMP() AS snapshot_timestamp,
    {dimension} AS dimension_value,
    COUNT(*) AS total_assets,

    -- Asset type breakdown as JSON
    OBJECT_AGG(DISTINCT A.ASSET_TYPE, type_counts.cnt) AS assets_by_type,

    -- Quality scores
    AVG(
        (CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 ELSE 0 END +
         CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END +
         0 + CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END
        ) / 8.0 * 100
    ) AS avg_completeness,

    AVG(
        (CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[\\w\\-\\.]+$') THEN 1 ELSE 0 END +
         CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         1
        ) / 5.0 * 100
    ) AS avg_accuracy,

    AVG(
        CASE WHEN DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, A.UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90
        THEN 100.0 ELSE 0.0 END
    ) AS avg_timeliness,

    AVG(
        (CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 2 THEN 1 ELSE 0 END +
         CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END
        ) / 4.0 * 100
    ) AS avg_consistency,

    AVG(
        (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
         CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
         1
        ) / 3.0 * 100
    ) AS avg_usability,

    -- Coverage metrics
    AVG(CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_description,
    AVG(CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_owner,
    AVG(CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_tags,
    AVG(CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1.0 ELSE 0.0 END) * 100 AS pct_certified,
    AVG(CASE WHEN A.HAS_LINEAGE = TRUE THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_lineage

FROM ATLAN_GOLD.PUBLIC.ASSETS A
LEFT JOIN ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS R ON A.GUID = R.GUID
LEFT JOIN (
    SELECT {dimension} as dim_val, ASSET_TYPE, COUNT(*) as cnt
    FROM ATLAN_GOLD.PUBLIC.ASSETS
    WHERE STATUS = 'ACTIVE'
    GROUP BY {dimension}, ASSET_TYPE
) type_counts ON type_counts.dim_val = {dimension} AND type_counts.ASSET_TYPE = A.ASSET_TYPE
WHERE A.STATUS = 'ACTIVE'
{asset_type_filter}
GROUP BY {dimension}
"""


SQL_LIST_OWNERS = """
SELECT DISTINCT
    owner.VALUE::STRING AS owner_id,
    COUNT(DISTINCT A.GUID) AS asset_count
FROM ATLAN_GOLD.PUBLIC.ASSETS A,
LATERAL FLATTEN(input => A.OWNER_USERS, outer => false) AS owner
WHERE A.STATUS = 'ACTIVE'
  AND owner.VALUE IS NOT NULL
GROUP BY owner.VALUE::STRING
ORDER BY asset_count DESC
LIMIT 500
"""


# ============================================
# Request/Response Models
# ============================================


class AssetSearchRequest(BaseModel):
    """Request for asset search."""

    query: str | None = Field(None, description="Search query string")
    asset_types: list[AssetType] | None = Field(None, description="Filter by asset types")
    connectors: list[str] | None = Field(None, description="Filter by connector names")
    limit: int = Field(100, ge=1, le=1000, description="Maximum results to return")
    offset: int = Field(0, ge=0, description="Offset for pagination")


class QualityScoreResult(BaseModel):
    """Quality score for a single asset."""

    guid: str
    asset_name: str
    asset_type: str
    connector_name: str | None
    completeness_score: float
    accuracy_score: float
    timeliness_score: float
    consistency_score: float
    usability_score: float
    overall_score: float | None = None


class QualityRollupResult(BaseModel):
    """Aggregated quality scores for a dimension value."""

    dimension_value: str
    total_assets: int
    pct_with_description: float
    pct_with_owner: float
    pct_with_tags: float
    pct_certified: float
    pct_with_lineage: float
    pct_with_readme: float = 0.0  # README documentation present
    pct_with_terms: float = 0.0  # Glossary terms linked
    avg_completeness: float
    avg_accuracy: float
    avg_timeliness: float
    avg_consistency: float
    avg_usability: float


class LineageNode(BaseModel):
    """A node in the lineage graph."""

    guid: str
    name: str
    asset_type: str
    direction: str
    level: int


class LineageResult(BaseModel):
    """Lineage traversal result."""

    start_guid: str
    upstream: list[LineageNode]
    downstream: list[LineageNode]


# ============================================
# Response Wrapper Models (for endpoint validation)
# ============================================


class AssetSummary(BaseModel):
    """Summary of an asset from search results."""

    guid: str
    asset_name: str
    asset_type: str
    asset_qualified_name: str | None = None
    description: str | None = None
    connector_name: str | None = None
    certificate_status: str | None = None
    has_lineage: bool | None = None
    popularity_score: float | None = None
    owner_users: list[str] | None = None
    tags: list[str] | None = None
    term_guids: list[str] | None = None
    updated_at: int | str | None = None
    source_updated_at: int | str | None = None

    class Config:
        extra = "allow"  # Allow additional fields from Snowflake


class AssetSearchResponse(BaseModel):
    """Response for asset search endpoint."""

    assets: list[AssetSummary]
    total_count: int
    limit: int
    offset: int


class QualityScoreResponse(BaseModel):
    """Response for quality scores endpoint."""

    scores: list[QualityScoreResult]
    limit: int
    offset: int


class QualityRollupResponse(BaseModel):
    """Response for quality rollup endpoint."""

    rollups: list[QualityRollupResult]
    dimension: str


class ConnectorInfo(BaseModel):
    """Information about a connector."""

    connector_name: str
    asset_count: int


class ConnectorsResponse(BaseModel):
    """Response for connectors listing endpoint."""

    connectors: list[ConnectorInfo]


class OwnerInfo(BaseModel):
    """Information about an owner."""

    owner_id: str
    asset_count: int


class OwnersResponse(BaseModel):
    """Response for owners listing endpoint."""

    owners: list[OwnerInfo]


# ============================================
# Dependency
# ============================================


class MdlhSessionContext:
    """Context for MDLH queries - wraps a session with query helpers."""

    # Errors that indicate a retry might succeed
    RETRYABLE_ERROR_PATTERNS = [
        "connection",
        "network",
        "timeout",
        "socket",
        "communication",
        "not connected",
        "connection reset",
    ]

    # Errors that indicate warehouse needs to be resumed
    # These are substring patterns - if ANY pattern matches, we try to resume
    WAREHOUSE_SUSPENDED_PATTERNS = [
        "no active warehouse",
        "warehouse cannot be used",
    ]
    # Keywords that when both appear indicate suspension
    WAREHOUSE_SUSPENDED_KEYWORDS = [
        ("warehouse", "suspend"),  # matches "warehouse is suspended", "warehouse being suspended", etc.
        ("warehouse", "not running"),
        ("warehouse", "starting"),
    ]

    MAX_RETRIES = 2  # Retry attempts after initial failure (allows warehouse resume + query retry)

    def __init__(self, session: SnowflakeSession, session_id: str):
        self.session = session
        self.session_id = session_id

    def _is_retryable_error(self, error: Exception) -> bool:
        """Check if an error is likely to succeed on retry."""
        error_msg = str(error).lower()
        return any(pattern in error_msg for pattern in self.RETRYABLE_ERROR_PATTERNS)

    def _is_warehouse_suspended_error(self, error: Exception) -> bool:
        """Check if error indicates warehouse is suspended."""
        error_msg = str(error).lower()
        # Check direct pattern matches
        if any(pattern in error_msg for pattern in self.WAREHOUSE_SUSPENDED_PATTERNS):
            return True
        # Check keyword pairs (both keywords must be present)
        for keyword1, keyword2 in self.WAREHOUSE_SUSPENDED_KEYWORDS:
            if keyword1 in error_msg and keyword2 in error_msg:
                return True
        return False

    def _resume_warehouse(self) -> bool:
        """Attempt to resume the Snowflake warehouse.

        Returns True if resume was successful, False otherwise.
        Includes a short wait time to allow the warehouse to start.
        """
        import time

        warehouse = self.session.warehouse
        if not warehouse:
            return False

        try:
            cursor = self.session.conn.cursor()
            # Use IF SUSPENDED to avoid errors if already running
            cursor.execute(f"ALTER WAREHOUSE {warehouse} RESUME IF SUSPENDED")
            cursor.close()
            logger.info(f"[MDLH] Resumed warehouse: {warehouse}")
            # Wait a moment for the warehouse to fully start
            time.sleep(2)
            return True
        except Exception as e:
            logger.warning(f"[MDLH] Failed to resume warehouse {warehouse}: {e}")
            return False

    def _verify_connection(self) -> bool:
        """Verify the connection is still alive with a simple query."""
        try:
            cursor = self.session.conn.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            return True
        except Exception:
            return False

    def execute_query(
        self,
        query: str,
        params: dict | None = None,
        session_id: str | None = None,  # ignored, uses self.session
    ) -> list[dict]:
        """Execute query and return results as list of dicts.

        Includes retry logic for transient connection failures:
        - On first failure, checks if error is retryable
        - Verifies connection is still alive
        - Retries once if connection is good
        - Raises SessionExpiredError if connection is dead
        """
        from datetime import datetime
        import logging

        logger = logging.getLogger(__name__)
        last_error: Exception | None = None

        for attempt in range(self.MAX_RETRIES + 1):
            cursor = self.session.conn.cursor()
            try:
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)

                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                rows = cursor.fetchall()

                results = []
                for row in rows:
                    row_dict = {}
                    for i, col in enumerate(columns):
                        value = row[i]
                        if isinstance(value, datetime):
                            value = value.isoformat()
                        row_dict[col] = value
                    results.append(row_dict)

                return results

            except Exception as e:
                last_error = e
                cursor.close()

                error_str = str(e).lower()
                logger.info(f"[MDLH] Query error (attempt {attempt + 1}/{self.MAX_RETRIES + 1}): {error_str[:200]}")

                # Check if warehouse is suspended - try to resume it
                is_warehouse_error = self._is_warehouse_suspended_error(e)
                logger.info(f"[MDLH] Is warehouse suspended error: {is_warehouse_error}")

                if attempt < self.MAX_RETRIES and is_warehouse_error:
                    logger.warning(
                        f"[MDLH] Query failed - warehouse suspended (attempt {attempt + 1}): {e}"
                    )
                    if self._resume_warehouse():
                        logger.info("[MDLH] Warehouse resumed, retrying query...")
                        continue
                    else:
                        logger.warning("[MDLH] Could not resume warehouse, raising error")
                        # Could not resume, let error handler deal with it
                        raise

                # Check if this is a retryable error
                if attempt < self.MAX_RETRIES and self._is_retryable_error(e):
                    logger.warning(
                        f"[MDLH] Query failed with retryable error (attempt {attempt + 1}): {e}"
                    )

                    # Verify connection is still alive before retry
                    if self._verify_connection():
                        logger.info("[MDLH] Connection verified, retrying query...")
                        continue
                    else:
                        logger.error("[MDLH] Connection lost, session needs reconnection")
                        raise SessionExpiredError(
                            "Snowflake connection lost - please reconnect"
                        ) from e

                # Non-retryable error or final attempt - raise immediately
                raise

            finally:
                try:
                    cursor.close()
                except Exception:
                    pass  # Ignore close errors

        # Should not reach here, but handle it gracefully
        if last_error:
            raise last_error
        raise RuntimeError("Query failed without error details")

    def execute_query_single(
        self,
        query: str,
        params: dict | None = None,
        session_id: str | None = None,
    ) -> dict | None:
        """Execute query and return single result or None."""
        results = self.execute_query(query, params)
        return results[0] if results else None

    # ========================================
    # Direct Snowflake Metadata Methods
    # ========================================
    # These query Snowflake directly (SHOW commands, INFORMATION_SCHEMA)
    # for raw schema exploration - not just MDLH Gold Layer

    def get_snowflake_databases(self, use_cache: bool = True) -> list[str]:
        """Get list of accessible Snowflake databases."""
        from ..services.cache import metadata_cache

        account = self.session.account or "unknown"

        if use_cache:
            cached = metadata_cache.get_databases(account)
            if cached is not None:
                return cached

        results = self.execute_query("SHOW DATABASES")
        databases = [row.get("name", row.get("NAME", "")) for row in results]
        databases = [d for d in databases if d]

        if use_cache:
            metadata_cache.set_databases(account, databases)

        return databases

    def get_snowflake_schemas(self, database: str, use_cache: bool = True) -> list[str]:
        """Get list of schemas in a Snowflake database."""
        from ..services.cache import metadata_cache
        import re

        # Validate identifier
        if not re.match(r'^[A-Za-z_][A-Za-z0-9_$]*$', database):
            raise ValueError(f"Invalid database name: {database}")

        account = self.session.account or "unknown"
        db_upper = database.upper()

        if use_cache:
            cached = metadata_cache.get_schemas(account, db_upper)
            if cached is not None:
                return cached

        results = self.execute_query(f'SHOW SCHEMAS IN DATABASE "{db_upper}"')
        schemas = [row.get("name", row.get("NAME", "")) for row in results]
        schemas = [s for s in schemas if s and s != "INFORMATION_SCHEMA"]

        if use_cache:
            metadata_cache.set_schemas(account, db_upper, schemas)

        return schemas

    def get_snowflake_tables(
        self, database: str, schema: str, include_views: bool = True, use_cache: bool = True
    ) -> list[dict]:
        """Get list of tables/views in a Snowflake schema."""
        from ..services.cache import metadata_cache
        import re

        # Validate identifiers
        if not re.match(r'^[A-Za-z_][A-Za-z0-9_$]*$', database):
            raise ValueError(f"Invalid database name: {database}")
        if not re.match(r'^[A-Za-z_][A-Za-z0-9_$]*$', schema):
            raise ValueError(f"Invalid schema name: {schema}")

        account = self.session.account or "unknown"
        db_upper = database.upper()
        schema_upper = schema.upper()

        if use_cache:
            cached = metadata_cache.get_tables(account, db_upper, schema_upper)
            if cached is not None:
                return cached

        # Get tables
        results = self.execute_query(f'SHOW TABLES IN "{db_upper}"."{schema_upper}"')
        tables = []
        for row in results:
            tables.append({
                "name": row.get("name", row.get("NAME", "")),
                "type": "TABLE",
                "rows": row.get("rows", row.get("ROWS", 0)),
                "bytes": row.get("bytes", row.get("BYTES", 0)),
            })

        # Get views if requested
        if include_views:
            try:
                view_results = self.execute_query(f'SHOW VIEWS IN "{db_upper}"."{schema_upper}"')
                for row in view_results:
                    tables.append({
                        "name": row.get("name", row.get("NAME", "")),
                        "type": "VIEW",
                        "rows": 0,
                        "bytes": 0,
                    })
            except Exception as e:
                logger.warning(f"Could not fetch views: {e}")

        if use_cache:
            metadata_cache.set_tables(account, db_upper, schema_upper, tables)

        return tables

    def get_snowflake_columns(
        self, database: str, schema: str, table: str, use_cache: bool = True
    ) -> list[dict]:
        """Get list of columns for a Snowflake table."""
        from ..services.cache import metadata_cache
        import re

        # Validate identifiers
        for name, label in [(database, "database"), (schema, "schema"), (table, "table")]:
            if not re.match(r'^[A-Za-z_][A-Za-z0-9_$]*$', name):
                raise ValueError(f"Invalid {label} name: {name}")

        account = self.session.account or "unknown"
        db_upper = database.upper()
        schema_upper = schema.upper()
        table_upper = table.upper()

        if use_cache:
            cached = metadata_cache.get_columns(account, db_upper, schema_upper, table_upper)
            if cached is not None:
                return cached

        query = f"""
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, ORDINAL_POSITION, COMMENT
        FROM "{db_upper}".INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '{schema_upper}' AND TABLE_NAME = '{table_upper}'
        ORDER BY ORDINAL_POSITION
        """
        results = self.execute_query(query)

        columns = []
        for row in results:
            columns.append({
                "name": row.get("COLUMN_NAME", ""),
                "type": row.get("DATA_TYPE", ""),
                "nullable": row.get("IS_NULLABLE", "YES") == "YES",
                "default": row.get("COLUMN_DEFAULT"),
                "position": row.get("ORDINAL_POSITION", 0),
                "comment": row.get("COMMENT"),
            })

        if use_cache:
            metadata_cache.set_columns(account, db_upper, schema_upper, table_upper, columns)

        return columns

    def get_snowflake_table_preview(
        self, database: str, schema: str, table: str, limit: int = 100
    ) -> dict:
        """Get preview data from a Snowflake table."""
        import re

        # Validate identifiers
        for name, label in [(database, "database"), (schema, "schema"), (table, "table")]:
            if not re.match(r'^[A-Za-z_][A-Za-z0-9_$]*$', name):
                raise ValueError(f"Invalid {label} name: {name}")

        db_upper = database.upper()
        schema_upper = schema.upper()
        table_upper = table.upper()
        limit = min(max(1, limit), 1000)

        columns = self.get_snowflake_columns(database, schema, table)
        query = f'SELECT * FROM "{db_upper}"."{schema_upper}"."{table_upper}" LIMIT {limit}'
        rows = self.execute_query(query)

        return {
            "columns": columns,
            "rows": rows,
            "total_rows": len(rows),
            "limit": limit,
        }


def get_session_id_from_request(
    request: Request,
    x_session_id: str | None = Header(None, alias="X-Session-ID"),
) -> str | None:
    """Extract session ID from header or query param."""
    # Try header first
    if x_session_id:
        return x_session_id
    # Try query param
    return request.query_params.get("session_id")


def require_mdlh_connection(
    request: Request,
    x_session_id: str | None = Header(None, alias="X-Session-ID"),
) -> MdlhSessionContext:
    """Dependency that requires an active MDLH connection via session_manager."""
    settings = get_settings()

    if not settings.mdlh_enabled:
        raise HTTPException(
            status_code=400,
            detail="MDLH integration is not enabled. Set DATA_BACKEND=mdlh in environment.",
        )

    # Get session ID from header or query param
    session_id = x_session_id or request.query_params.get("session_id")
    
    if not session_id:
        # Check if there's any active session
        stats = session_manager.get_stats()
        if stats.get("active_sessions", 0) == 0:
            raise HTTPException(
                status_code=503,
                detail="No active Snowflake connection. Connect via /api/snowflake/connect first.",
            )
        # For convenience, try to use the first available session
        # This is a fallback for simpler testing
        with session_manager._lock:
            if session_manager._sessions:
                session_id = next(iter(session_manager._sessions.keys()))
    
    session = session_manager.get_session(session_id) if session_id else None
    
    if not session:
        raise HTTPException(
            status_code=503,
            detail="No active Snowflake connection. Connect via /api/snowflake/connect first.",
        )

    return MdlhSessionContext(session=session, session_id=session_id)


# ============================================
# Endpoints
# ============================================


def escape_sql_string(value: str) -> str:
    """Escape a string for safe use in SQL queries."""
    return value.replace("'", "''")


@router.get("/assets", response_model=AssetSearchResponse)
@handle_mdlh_errors
async def search_assets(
    query: str | None = Query(None, description="Text search in name/description"),
    asset_type: AssetType = Query(AssetType.ALL, description="Filter by asset type"),
    connector: str | None = Query(None, description="Filter by connector name"),
    database: str | None = Query(None, description="Filter by database name"),
    schema: str | None = Query(None, alias="schema", description="Filter by schema name"),
    include_tags: bool = Query(False, description="Include tags in text search"),
    limit: int = Query(100, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> AssetSearchResponse:
    """
    Unified asset search endpoint for the MDLH Gold Layer.

    Supports filtering by:
    - query: Text search in asset name and description (optionally tags)
    - asset_type: Filter by Table, View, MaterializedView, etc.
    - connector: Filter by connector/connection name
    - database: Filter by database name (derived from qualified_name)
    - schema: Filter by schema name (derived from qualified_name)

    Results are ordered by relevance (if query provided) or popularity.

    This endpoint consolidates: /assets, /search, /hierarchy/assets
    """
    # Build parameterized query for safety
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    conditions = ["A.STATUS = 'ACTIVE'"]

    # Asset type filter
    if asset_type != AssetType.ALL:
        conditions.append("A.ASSET_TYPE = %(asset_type)s")
        params["asset_type"] = asset_type.value

    # Connector filter
    if connector:
        conditions.append("A.CONNECTOR_NAME = %(connector)s")
        params["connector"] = connector

    # Database filter (from qualified name segment 4: default/snowflake/account/DATABASE/schema/table)
    if database:
        conditions.append("SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4) = %(database)s")
        params["database"] = database

    # Schema filter (from qualified name segment 5: default/snowflake/account/database/SCHEMA/table)
    if schema:
        conditions.append("SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5) = %(schema)s")
        params["schema"] = schema

    # Text search filter
    search_conditions = []
    if query:
        params["search_query"] = f"%{query}%"
        search_conditions.append("A.ASSET_NAME ILIKE %(search_query)s")
        search_conditions.append("A.DESCRIPTION ILIKE %(search_query)s")
        if include_tags:
            search_conditions.append(
                "EXISTS (SELECT 1 FROM TABLE(FLATTEN(A.TAGS)) t WHERE t.VALUE::STRING ILIKE %(search_query)s)"
            )
        conditions.append(f"({' OR '.join(search_conditions)})")

    where_clause = " AND ".join(conditions)

    # Build relevance-based ordering if query provided
    order_clause = "A.POPULARITY_SCORE DESC NULLS LAST, A.UPDATED_AT DESC"
    if query:
        # Add relevance scoring for text search
        order_clause = """
            CASE
                WHEN LOWER(A.ASSET_NAME) = LOWER(%(search_query)s) THEN 100
                WHEN LOWER(A.ASSET_NAME) LIKE LOWER(%(search_query)s) THEN 80
                WHEN LOWER(A.ASSET_NAME) ILIKE %(search_query)s THEN 60
                WHEN LOWER(A.DESCRIPTION) ILIKE %(search_query)s THEN 40
                ELSE 20
            END DESC,
            A.POPULARITY_SCORE DESC NULLS LAST
        """

    sql = f"""
    SELECT
        A.GUID,
        A.ASSET_NAME,
        A.ASSET_TYPE,
        A.ASSET_QUALIFIED_NAME,
        A.DESCRIPTION,
        A.CONNECTOR_NAME,
        A.CERTIFICATE_STATUS,
        A.HAS_LINEAGE,
        A.POPULARITY_SCORE,
        A.OWNER_USERS,
        A.TAGS,
        A.TERM_GUIDS,
        A.UPDATED_AT,
        A.SOURCE_UPDATED_AT
    FROM ATLAN_GOLD.PUBLIC.ASSETS A
    WHERE {where_clause}
    ORDER BY {order_clause}
    LIMIT %(limit)s
    OFFSET %(offset)s
    """

    results = service.execute_query(sql, params=params)

    # Get total count with same filters
    count_sql = f"""
    SELECT COUNT(*) as total_count
    FROM ATLAN_GOLD.PUBLIC.ASSETS A
    WHERE {where_clause}
    """
    count_result = service.execute_query_single(count_sql, params=params)
    total_count = count_result.get("TOTAL_COUNT", 0) if count_result else 0

    # Transform results to Pydantic models
    assets = []
    for row in results:
        asset = AssetSummary(
            guid=row.get("GUID", ""),
            asset_name=row.get("ASSET_NAME", ""),
            asset_type=row.get("ASSET_TYPE", ""),
            asset_qualified_name=row.get("ASSET_QUALIFIED_NAME"),
            description=row.get("DESCRIPTION"),
            connector_name=row.get("CONNECTOR_NAME"),
            certificate_status=row.get("CERTIFICATE_STATUS"),
            has_lineage=row.get("HAS_LINEAGE"),
            popularity_score=row.get("POPULARITY_SCORE"),
            owner_users=parse_json_array(row.get("OWNER_USERS")),
            tags=parse_json_array(row.get("TAGS")),
            term_guids=parse_json_array(row.get("TERM_GUIDS")),
            updated_at=row.get("UPDATED_AT"),
            source_updated_at=row.get("SOURCE_UPDATED_AT"),
        )
        assets.append(asset)

    return AssetSearchResponse(
        assets=assets,
        total_count=total_count,
        limit=limit,
        offset=offset,
    )


@router.get("/quality-scores", response_model=QualityScoreResponse)
@handle_mdlh_errors
async def get_quality_scores(
    asset_type: AssetType = AssetType.ALL,
    connector: str | None = Query(None, description="Filter by connector name"),
    database: str | None = Query(None, description="Filter by database name (from qualified name)"),
    schema_name: str | None = Query(None, alias="schema", description="Filter by schema name (from qualified name)"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> QualityScoreResponse:
    """
    Get quality scores for assets with optional context filtering.

    Returns completeness, accuracy, timeliness, consistency, and usability
    scores for each asset, computed using MDLH data.

    Filter parameters allow scoping to specific context:
    - connector: Filter to specific connector (e.g., "snowflake")
    - database: Filter to specific database (first segment of qualified name)
    - schema: Filter to specific schema (second segment of qualified name)
    """
    # Build filters with SQL injection protection
    type_filter = ""
    if asset_type != AssetType.ALL:
        type_filter = f"AND A.ASSET_TYPE = '{escape_sql_string(asset_type.value)}'"

    connector_filter = ""
    if connector:
        connector_filter = f"AND A.CONNECTOR_NAME = '{escape_sql_string(connector)}'"

    database_filter = ""
    if database:
        database_filter = f"AND SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4) = '{escape_sql_string(database)}'"

    schema_filter = ""
    if schema_name:
        schema_filter = f"AND SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5) = '{escape_sql_string(schema_name)}'"

    sql = f"""
    {SQL_QUALITY_SCORES}
    {type_filter}
    {connector_filter}
    {database_filter}
    {schema_filter}
    ORDER BY A.POPULARITY_SCORE DESC NULLS LAST
    LIMIT {limit}
    OFFSET {offset}
    """

    results = service.execute_query(sql)

    # Transform to Pydantic models with overall score calculation
    scores = []
    for row in results:
        completeness = row.get("COMPLETENESS_SCORE", 0) or 0
        accuracy = row.get("ACCURACY_SCORE", 0) or 0
        timeliness = row.get("TIMELINESS_SCORE", 0) or 0
        consistency = row.get("CONSISTENCY_SCORE", 0) or 0
        usability = row.get("USABILITY_SCORE", 0) or 0

        overall = (
            completeness * 0.25 +
            accuracy * 0.20 +
            timeliness * 0.20 +
            consistency * 0.15 +
            usability * 0.20
        )

        score = QualityScoreResult(
            guid=row.get("GUID", ""),
            asset_name=row.get("ASSET_NAME", ""),
            asset_type=row.get("ASSET_TYPE", ""),
            connector_name=row.get("CONNECTOR_NAME"),
            completeness_score=completeness,
            accuracy_score=accuracy,
            timeliness_score=timeliness,
            consistency_score=consistency,
            usability_score=usability,
            overall_score=round(overall, 2),
        )
        scores.append(score)

    return QualityScoreResponse(
        scores=scores,
        limit=limit,
        offset=offset,
    )


class BatchScoreRequest(BaseModel):
    """Request body for batch quality score fetching."""
    guids: list[str] = Field(..., max_length=1000, description="List of asset GUIDs to fetch scores for")


@router.post("/quality-scores/batch")
@handle_mdlh_errors
async def get_quality_scores_batch(
    request: BatchScoreRequest,
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get quality scores for specific asset GUIDs.
    
    This endpoint is optimized for the frontend ScoresStore which needs
    to score a specific set of assets loaded into context.
    """
    if not request.guids:
        return {"scores": [], "count": 0}
    
    # Limit to 1000 GUIDs per request
    guids = request.guids[:1000]
    
    # Build IN clause with proper escaping
    guid_list = ",".join(f"'{g.replace(chr(39), chr(39)+chr(39))}'" for g in guids)
    
    sql = f"""
    {SQL_QUALITY_SCORES}
    AND A.GUID IN ({guid_list})
    """
    
    results = service.execute_query(sql)
    
    # Calculate overall score for each result
    for row in results:
        overall = (
            row.get("COMPLETENESS_SCORE", 0) * 0.25 +
            row.get("ACCURACY_SCORE", 0) * 0.20 +
            row.get("TIMELINESS_SCORE", 0) * 0.20 +
            row.get("CONSISTENCY_SCORE", 0) * 0.15 +
            row.get("USABILITY_SCORE", 0) * 0.20
        )
        row["OVERALL_SCORE"] = round(overall, 2)
    
    return {
        "scores": results,
        "count": len(results),
        "requested": len(guids),
    }


@router.get("/quality")
@handle_mdlh_errors
async def get_quality_unified(
    dimension: PivotDimension = Query(PivotDimension.CONNECTOR, description="Dimension to group by"),
    asset_type: AssetType = Query(AssetType.ALL, description="Filter by asset type"),
    connector: str | None = Query(None, description="Filter by connector name"),
    database: str | None = Query(None, description="Filter by database name (from qualified name)"),
    schema_name: str | None = Query(None, alias="schema", description="Filter by schema name (from qualified name)"),
    limit: int = Query(100, ge=1, le=500, description="Max results to return"),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Unified quality metrics endpoint - aggregates scores by dimension.

    Supports all dimensions including:
    - connector: Group by connector/connection name
    - database: Group by database name
    - schema: Group by schema name
    - asset_type: Group by asset type (Table, View, etc.)
    - certificate_status: Group by certification status
    - owner: Group by owner (uses LATERAL FLATTEN for array handling)

    Filter parameters allow scoping to specific context:
    - connector: Filter to specific connector (e.g., "snowflake")
    - database: Filter to specific database (first segment of qualified name)
    - schema: Filter to specific schema (second segment of qualified name)

    This endpoint consolidates: /quality-rollup, /quality-rollup/by-owner

    Returns:
    - dimension: The grouping dimension
    - rollups: List of aggregated metrics per dimension value, including:
        - dimension_value: The value of the dimension
        - total_assets: Number of assets in this group
        - avg_completeness, avg_accuracy, avg_timeliness, avg_consistency, avg_usability
        - avg_overall: Weighted overall score
        - pct_with_description, pct_with_owner, pct_with_tags, etc.
    """
    # Build filters
    params: dict[str, Any] = {}
    filters = []

    if asset_type != AssetType.ALL:
        filters.append("A.ASSET_TYPE = %(asset_type)s")
        params["asset_type"] = asset_type.value

    if connector:
        filters.append("A.CONNECTOR_NAME = %(connector)s")
        params["connector"] = connector

    if database:
        filters.append("SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4) = %(database)s")
        params["database"] = database

    if schema_name:
        filters.append("SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5) = %(schema_name)s")
        params["schema_name"] = schema_name

    asset_type_filter = f"AND {' AND '.join(filters)}" if filters else ""

    # Special handling for owner dimension (requires LATERAL FLATTEN)
    if dimension == PivotDimension.OWNER:
        sql = f"""
        SELECT
            COALESCE(owner.VALUE::STRING, 'Unowned') AS dimension_value,
            COUNT(DISTINCT A.GUID) AS total_assets,
            AVG(CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_description,
            AVG(CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_tags,
            AVG(CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1.0 ELSE 0.0 END) * 100 AS pct_certified,
            AVG(CASE WHEN A.HAS_LINEAGE = TRUE THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_lineage,
            AVG(CASE WHEN A.README_GUID IS NOT NULL THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_readme,
            AVG(CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_terms,
            AVG(CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_owner,
            AVG((CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 ELSE 0 END +
                 CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
                 CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_STATUS != '' THEN 1 ELSE 0 END +
                 CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
                 CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
                 CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END +
                 CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END) / 8.0 * 100) AS avg_completeness,
            AVG((CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[\\w\\-\\.]+$') THEN 1 ELSE 0 END +
                 CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
                 CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_STATUS != '' THEN 1 ELSE 0 END +
                 CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
                 1) / 5.0 * 100) AS avg_accuracy,
            AVG(CASE WHEN (DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
                          DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90)
                THEN 100.0 ELSE 0.0 END) AS avg_timeliness,
            AVG((CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
                 CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
                 CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 2 THEN 1 ELSE 0 END +
                 CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END) / 4.0 * 100) AS avg_consistency,
            AVG((CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
                 CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
                 1) / 3.0 * 100) AS avg_usability
        FROM ATLAN_GOLD.PUBLIC.ASSETS A
        LEFT JOIN ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS R ON A.GUID = R.GUID,
        LATERAL FLATTEN(input => COALESCE(A.OWNER_USERS, ARRAY_CONSTRUCT(NULL)), outer => true) AS owner
        WHERE A.STATUS = 'ACTIVE'
        {asset_type_filter}
        GROUP BY COALESCE(owner.VALUE::STRING, 'Unowned')
        ORDER BY total_assets DESC
        LIMIT {limit}
        """
    else:
        # Standard dimension rollup
        # Qualified name structure: default/snowflake/account/DATABASE/SCHEMA/TABLE/COLUMN
        dimension_map = {
            PivotDimension.CONNECTOR: "A.CONNECTOR_NAME",
            PivotDimension.DATABASE: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4)",
            PivotDimension.SCHEMA: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5)",
            PivotDimension.ASSET_TYPE: "A.ASSET_TYPE",
            PivotDimension.CERTIFICATE_STATUS: "COALESCE(A.CERTIFICATE_STATUS, 'NONE')",
        }
        dimension_col = dimension_map.get(dimension, "A.CONNECTOR_NAME")

        sql = f"""
        SELECT
            {dimension_col} AS dimension_value,
            COUNT(*) AS total_assets,
            AVG(CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_description,
            AVG(CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_owner,
            AVG(CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_tags,
            AVG(CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1.0 ELSE 0.0 END) * 100 AS pct_certified,
            AVG(CASE WHEN A.HAS_LINEAGE = TRUE THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_lineage,
            AVG(CASE WHEN A.README_GUID IS NOT NULL THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_readme,
            AVG(CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_terms,
            AVG((CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 ELSE 0 END +
                 CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
                 CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_STATUS != '' THEN 1 ELSE 0 END +
                 CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
                 CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
                 CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END +
                 CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END) / 8.0 * 100) AS avg_completeness,
            AVG((CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[\\w\\-\\.]+$') THEN 1 ELSE 0 END +
                 CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
                 CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_STATUS != '' THEN 1 ELSE 0 END +
                 CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
                 1) / 5.0 * 100) AS avg_accuracy,
            AVG(CASE WHEN (DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
                          DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90)
                THEN 100.0 ELSE 0.0 END) AS avg_timeliness,
            AVG((CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
                 CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
                 CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 2 THEN 1 ELSE 0 END +
                 CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END) / 4.0 * 100) AS avg_consistency,
            AVG((CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
                 CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
                 1) / 3.0 * 100) AS avg_usability
        FROM ATLAN_GOLD.PUBLIC.ASSETS A
        LEFT JOIN ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS R ON A.GUID = R.GUID
        WHERE A.STATUS = 'ACTIVE'
        {asset_type_filter}
        GROUP BY {dimension_col}
        ORDER BY total_assets DESC
        LIMIT {limit}
        """

    results = service.execute_query(sql, params=params if params else None)

    # Calculate overall score for each rollup
    for row in results:
        overall = (
            (row.get("AVG_COMPLETENESS") or 0) * 0.25 +
            (row.get("AVG_ACCURACY") or 0) * 0.20 +
            (row.get("AVG_TIMELINESS") or 0) * 0.20 +
            (row.get("AVG_CONSISTENCY") or 0) * 0.15 +
            (row.get("AVG_USABILITY") or 0) * 0.20
        )
        row["AVG_OVERALL"] = round(overall, 2)

    return {
        "dimension": dimension.value,
        "filters": {
            "asset_type": asset_type.value if asset_type != AssetType.ALL else None,
            "connector": connector,
        },
        "rollups": results,
        "count": len(results),
    }


@router.get("/quality-rollup")
@handle_mdlh_errors
async def get_quality_rollup(
    dimension: PivotDimension = PivotDimension.CONNECTOR,
    asset_type: AssetType = AssetType.ALL,
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    DEPRECATED: Use /quality endpoint instead.

    Get aggregated quality scores by dimension.

    Computes average scores grouped by the specified dimension
    (connector, database, schema, asset_type, or certificate_status).
    """
    # Map dimension to SQL column
    # Qualified name structure: default/snowflake/account/DATABASE/SCHEMA/TABLE/COLUMN
    dimension_map = {
        PivotDimension.CONNECTOR: "A.CONNECTOR_NAME",
        PivotDimension.DATABASE: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4)",
        PivotDimension.SCHEMA: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5)",
        PivotDimension.ASSET_TYPE: "A.ASSET_TYPE",
        PivotDimension.CERTIFICATE_STATUS: "COALESCE(A.CERTIFICATE_STATUS, 'NONE')",
    }

    dimension_col = dimension_map.get(dimension, "A.CONNECTOR_NAME")

    # Build asset type filter
    asset_type_filter = ""
    if asset_type != AssetType.ALL:
        asset_type_filter = f"AND A.ASSET_TYPE = '{asset_type.value}'"

    sql = SQL_QUALITY_ROLLUP.format(
        dimension=dimension_col,
        asset_type_filter=asset_type_filter,
    )

    results = service.execute_query(sql)

    # Calculate overall score for each rollup
    for row in results:
        overall = (
            row.get("AVG_COMPLETENESS", 0) * 0.25 +
            row.get("AVG_ACCURACY", 0) * 0.20 +
            row.get("AVG_TIMELINESS", 0) * 0.20 +
            row.get("AVG_CONSISTENCY", 0) * 0.15 +
            row.get("AVG_USABILITY", 0) * 0.20
        )
        row["AVG_OVERALL"] = round(overall, 2)

    return {
        "dimension": dimension.value,
        "rollups": results,
    }


@router.get("/lineage/{guid}")
@handle_mdlh_errors
async def get_lineage(
    guid: str,
    direction: LineageDirection = LineageDirection.BOTH,
    max_level: int = Query(5, ge=1, le=10),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> LineageResult:
    """
    Get lineage for an asset.

    Returns upstream and/or downstream lineage up to the specified depth.
    """
    # Build direction filter
    direction_filter = ""
    if direction == LineageDirection.UPSTREAM:
        direction_filter = "AND DIRECTION = 'UPSTREAM'"
    elif direction == LineageDirection.DOWNSTREAM:
        direction_filter = "AND DIRECTION = 'DOWNSTREAM'"

    level_filter = f"AND LEVEL <= {max_level}"

    sql = SQL_LINEAGE.format(
        direction_filter=direction_filter,
        level_filter=level_filter,
    )

    results = service.execute_query(sql, params={"guid": guid})

    # Separate upstream and downstream
    upstream = []
    downstream = []

    for row in results:
        node = LineageNode(
            guid=row["RELATED_GUID"],
            name=row["RELATED_NAME"],
            asset_type=row["RELATED_TYPE"],
            direction=row["DIRECTION"],
            level=row["LEVEL"],
        )
        if row["DIRECTION"] == "UPSTREAM":
            upstream.append(node)
        else:
            downstream.append(node)

    return LineageResult(
        start_guid=guid,
        upstream=upstream,
        downstream=downstream,
    )


@router.get("/connectors", response_model=ConnectorsResponse)
@handle_mdlh_errors
async def get_connectors(
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> ConnectorsResponse:
    """
    Get list of available connectors with asset counts.
    """
    results = service.execute_query(SQL_CONNECTORS)
    connectors = [
        ConnectorInfo(
            connector_name=row.get("CONNECTOR_NAME", ""),
            asset_count=row.get("ASSET_COUNT", 0),
        )
        for row in results
    ]
    return ConnectorsResponse(connectors=connectors)


@router.get("/databases")
@handle_mdlh_errors
async def get_databases(
    connector: str | None = None,
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get list of databases with asset counts.
    """
    sql = SQL_DATABASES
    if connector:
        # SQL injection protection
        escaped_connector = escape_sql_string(connector)
        sql = sql.replace(
            "ORDER BY asset_count DESC",
            f"HAVING CONNECTOR_NAME = '{escaped_connector}' ORDER BY asset_count DESC"
        )

    results = service.execute_query(sql)
    return {"databases": results}


@router.get("/pivot")
@handle_mdlh_errors
async def get_pivot_data(
    row_dimension: PivotDimension = PivotDimension.CONNECTOR,
    column_dimension: PivotDimension = PivotDimension.ASSET_TYPE,
    metric: str = Query("count", regex="^(count|completeness|accuracy|timeliness|consistency|usability|overall)$"),
    asset_type: AssetType = AssetType.ALL,
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get pivot table data for analytics.

    Returns data aggregated by two dimensions, suitable for pivot table display.
    """
    # Map dimensions to SQL columns
    # Qualified name structure: default/snowflake/account/DATABASE/SCHEMA/TABLE/COLUMN
    dimension_map = {
        PivotDimension.CONNECTOR: "A.CONNECTOR_NAME",
        PivotDimension.DATABASE: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4)",
        PivotDimension.SCHEMA: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5)",
        PivotDimension.ASSET_TYPE: "A.ASSET_TYPE",
        PivotDimension.CERTIFICATE_STATUS: "COALESCE(A.CERTIFICATE_STATUS, 'NONE')",
    }

    row_col = dimension_map.get(row_dimension, "A.CONNECTOR_NAME")
    col_col = dimension_map.get(column_dimension, "A.ASSET_TYPE")

    # Determine metric calculation
    metric_sql_map = {
        "count": "COUNT(*)",
        "completeness": """AVG(
            (CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 ELSE 0 END +
             CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END +
             CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN R.TABLE_COLUMN_COUNT > 0 OR A.ASSET_TYPE NOT IN ('Table','View') THEN 1 ELSE 0 END
            ) / 6.0 * 100
        )""",
        "accuracy": """AVG(
            (CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[A-Za-z_][A-Za-z0-9_]*$') THEN 1 ELSE 0 END +
             CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1 ELSE 0 END +
             CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END +
             1
            ) / 5.0 * 100
        )""",
        "timeliness": """AVG(
            CASE WHEN DATEDIFF('day', 
                TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, A.UPDATED_AT)/1000), 
                CURRENT_TIMESTAMP()) <= 90 
            THEN 100.0 ELSE 0.0 END
        )""",
        "consistency": """AVG(
            (CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END +
             CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 3 THEN 1 ELSE 0 END +
             CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[a-z][a-z0-9_]*$') THEN 1 ELSE 0 END
            ) / 4.0 * 100
        )""",
        "usability": """AVG(
            (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
             CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
             CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END +
             1
            ) / 4.0 * 100
        )""",
    }

    # For "overall", compute weighted average
    if metric == "overall":
        metric_sql = """(
            AVG((CASE WHEN A.DESCRIPTION IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END + CASE WHEN ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END + CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END + 1) / 6.0 * 100) * 0.25 +
            AVG((CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[A-Za-z_][A-Za-z0-9_]*$') THEN 1 ELSE 0 END + CASE WHEN ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END + CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1 ELSE 0 END + 1 + 1) / 5.0 * 100) * 0.20 +
            AVG(CASE WHEN DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, A.UPDATED_AT)/1000), CURRENT_TIMESTAMP()) <= 90 THEN 100.0 ELSE 0.0 END) * 0.20 +
            AVG((CASE WHEN ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END + 1 + 1 + CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[a-z][a-z0-9_]*$') THEN 1 ELSE 0 END) / 4.0 * 100) * 0.15 +
            AVG((CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END + 1 + CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END + 1) / 4.0 * 100) * 0.20
        )"""
    else:
        metric_sql = metric_sql_map.get(metric, "COUNT(*)")

    # Build asset type filter
    type_filter = ""
    if asset_type != AssetType.ALL:
        type_filter = f"AND A.ASSET_TYPE = '{asset_type.value}'"

    sql = f"""
    SELECT
        {row_col} AS row_dimension,
        {col_col} AS col_dimension,
        {metric_sql} AS metric_value
    FROM ATLAN_GOLD.PUBLIC.ASSETS A
    LEFT JOIN ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS R ON A.GUID = R.GUID
    WHERE A.STATUS = 'ACTIVE'
    {type_filter}
    GROUP BY {row_col}, {col_col}
    ORDER BY row_dimension, col_dimension
    """

    results = service.execute_query(sql)

    # Transform to pivot format
    pivot_data = {}
    column_values = set()

    for row in results:
        row_key = row.get("ROW_DIMENSION") or "Unknown"
        col_key = row.get("COL_DIMENSION") or "Unknown"
        value = row.get("METRIC_VALUE", 0)

        if row_key not in pivot_data:
            pivot_data[row_key] = {}
        pivot_data[row_key][col_key] = round(value, 2) if isinstance(value, float) else value
        column_values.add(col_key)

    return {
        "row_dimension": row_dimension.value,
        "column_dimension": column_dimension.value,
        "metric": metric,
        "columns": sorted(list(column_values)),
        "data": pivot_data,
    }


# ============================================
# Hierarchy Endpoints
# ============================================
# These endpoints derive hierarchy from ASSET_QUALIFIED_NAME
# to support context bar navigation


class HierarchyItem(BaseModel):
    """Base model for hierarchy items."""

    name: str
    asset_count: int
    sample_guid: str | None = None


class TableItem(BaseModel):
    """Model for table/view items in hierarchy."""

    guid: str
    name: str
    asset_type: str
    qualified_name: str
    description: str | None = None
    certificate_status: str | None = None
    has_lineage: bool = False
    popularity_score: float | None = None
    owner_users: list[str] | None = None
    tags: list[str] | None = None
    updated_at: int | None = None


class AssetDetail(BaseModel):
    """Full asset details model."""

    guid: str
    name: str
    asset_type: str
    qualified_name: str
    connector_name: str | None = None
    connector_qualified_name: str | None = None
    description: str | None = None
    certificate_status: str | None = None
    has_lineage: bool = False
    popularity_score: float | None = None
    owner_users: list[str] | None = None
    tags: list[str] | None = None
    term_guids: list[str] | None = None
    readme_guid: str | None = None
    updated_at: int | None = None
    source_updated_at: int | None = None
    created_at: int | None = None
    created_by: str | None = None
    updated_by: str | None = None
    status: str | None = None
    # Relational details (from RELATIONAL_ASSET_DETAILS view)
    column_count: int | None = None
    row_count: int | None = None
    size_bytes: int | None = None
    read_count: int | None = None
    # Derived from ASSET_QUALIFIED_NAME
    database_name: str | None = None
    schema_name: str | None = None


SQL_HIERARCHY_CONNECTORS = """
SELECT 
    CONNECTOR_NAME,
    COUNT(*) as asset_count
FROM ATLAN_GOLD.PUBLIC.ASSETS 
WHERE STATUS = 'ACTIVE' 
  AND CONNECTOR_NAME IS NOT NULL
GROUP BY CONNECTOR_NAME
ORDER BY asset_count DESC
"""


SQL_HIERARCHY_DATABASES = """
SELECT DISTINCT
    SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 4) as database_name,
    MIN(GUID) as sample_guid,
    COUNT(*) as asset_count
FROM ATLAN_GOLD.PUBLIC.ASSETS
WHERE STATUS = 'ACTIVE'
  AND CONNECTOR_NAME = %(connector)s
  AND ASSET_QUALIFIED_NAME IS NOT NULL
  AND UPPER(ASSET_TYPE) IN ('DATABASE', 'TABLE', 'VIEW', 'MATERIALIZEDVIEW', 'SCHEMA')
GROUP BY database_name
HAVING database_name IS NOT NULL AND database_name != ''
ORDER BY asset_count DESC
"""


SQL_HIERARCHY_SCHEMAS = """
SELECT DISTINCT
    SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 5) as schema_name,
    MIN(GUID) as sample_guid,
    COUNT(*) as asset_count
FROM ATLAN_GOLD.PUBLIC.ASSETS
WHERE STATUS = 'ACTIVE'
  AND CONNECTOR_NAME = %(connector)s
  AND SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 4) = %(database)s
  AND ASSET_QUALIFIED_NAME IS NOT NULL
  AND UPPER(ASSET_TYPE) IN ('SCHEMA', 'TABLE', 'VIEW', 'MATERIALIZEDVIEW')
GROUP BY schema_name
HAVING schema_name IS NOT NULL AND schema_name != ''
ORDER BY asset_count DESC
"""

# Use SQL_CONNECTORS directly - just reference it
# (Testing if the issue is query content vs endpoint execution)


SQL_HIERARCHY_TABLES = """
SELECT
    -- ==========================================================================
    -- ALL ASSETS FIELDS (25 columns from MDLH Gold Layer ASSETS view)
    -- ==========================================================================
    GUID,
    ASSET_NAME,
    ASSET_TYPE,
    ASSET_QUALIFIED_NAME,
    DESCRIPTION,
    README_GUID,
    STATUS,
    -- Lifecycle timestamps
    CREATED_AT,
    CREATED_BY,
    UPDATED_AT,
    UPDATED_BY,
    -- Certificate fields
    CERTIFICATE_STATUS,
    CERTIFICATE_UPDATED_BY,
    CERTIFICATE_UPDATED_AT,
    -- Connector fields
    CONNECTOR_NAME,
    CONNECTOR_QUALIFIED_NAME,
    -- Source system timestamps
    SOURCE_CREATED_AT,
    SOURCE_CREATED_BY,
    SOURCE_UPDATED_AT,
    SOURCE_UPDATED_BY,
    -- Ownership and classification
    OWNER_USERS,
    TERM_GUIDS,
    TAGS,
    -- Metrics
    POPULARITY_SCORE,
    HAS_LINEAGE
FROM ATLAN_GOLD.PUBLIC.ASSETS
WHERE STATUS = 'ACTIVE'
  AND CONNECTOR_NAME = %(connector)s
  AND SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 4) = %(database)s
  AND SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 5) = %(schema)s
  AND UPPER(ASSET_TYPE) IN ('TABLE', 'VIEW', 'MATERIALIZEDVIEW')
ORDER BY POPULARITY_SCORE DESC NULLS LAST, ASSET_NAME ASC
LIMIT %(limit)s
"""


SQL_ASSET_DETAIL = """
SELECT
    -- ==========================================================================
    -- ALL ASSETS FIELDS (25 columns from MDLH Gold Layer ASSETS view)
    -- ==========================================================================
    A.GUID,
    A.ASSET_NAME,
    A.ASSET_TYPE,
    A.ASSET_QUALIFIED_NAME,
    A.DESCRIPTION,
    A.README_GUID,
    A.STATUS,
    -- Lifecycle timestamps
    A.CREATED_AT,
    A.CREATED_BY,
    A.UPDATED_AT,
    A.UPDATED_BY,
    -- Certificate fields
    A.CERTIFICATE_STATUS,
    A.CERTIFICATE_UPDATED_BY,
    A.CERTIFICATE_UPDATED_AT,
    -- Connector fields
    A.CONNECTOR_NAME,
    A.CONNECTOR_QUALIFIED_NAME,
    -- Source system timestamps
    A.SOURCE_CREATED_AT,
    A.SOURCE_CREATED_BY,
    A.SOURCE_UPDATED_AT,
    A.SOURCE_UPDATED_BY,
    -- Ownership and classification
    A.OWNER_USERS,
    A.TERM_GUIDS,
    A.TAGS,
    -- Metrics
    A.POPULARITY_SCORE,
    A.HAS_LINEAGE,
    -- ==========================================================================
    -- RELATIONAL_ASSET_DETAILS fields (extended table/view metadata)
    -- ==========================================================================
    R.TABLE_COLUMN_COUNT,
    R.TABLE_ROW_COUNT,
    R.TABLE_SIZE_BYTES,
    R.TABLE_TOTAL_READ_COUNT,
    -- Derived fields (qualified name: default/snowflake/account/DATABASE/SCHEMA/TABLE/COLUMN)
    SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4) AS DATABASE_NAME,
    SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5) AS SCHEMA_NAME
FROM ATLAN_GOLD.PUBLIC.ASSETS A
LEFT JOIN ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS R ON A.GUID = R.GUID
WHERE A.GUID = %(guid)s
"""


SQL_HIERARCHY_ASSETS_IN_CONTEXT = """
SELECT
    -- ==========================================================================
    -- ALL ASSETS FIELDS (25 columns from MDLH Gold Layer ASSETS view)
    -- ==========================================================================
    A.GUID,
    A.ASSET_NAME,
    A.ASSET_TYPE,
    A.ASSET_QUALIFIED_NAME,
    A.DESCRIPTION,
    A.README_GUID,
    A.STATUS,
    -- Lifecycle timestamps
    A.CREATED_AT,
    A.CREATED_BY,
    A.UPDATED_AT,
    A.UPDATED_BY,
    -- Certificate fields
    A.CERTIFICATE_STATUS,
    A.CERTIFICATE_UPDATED_BY,
    A.CERTIFICATE_UPDATED_AT,
    -- Connector fields
    A.CONNECTOR_NAME,
    A.CONNECTOR_QUALIFIED_NAME,
    -- Source system timestamps
    A.SOURCE_CREATED_AT,
    A.SOURCE_CREATED_BY,
    A.SOURCE_UPDATED_AT,
    A.SOURCE_UPDATED_BY,
    -- Ownership and classification
    A.OWNER_USERS,
    A.TERM_GUIDS,
    A.TAGS,
    -- Metrics
    A.POPULARITY_SCORE,
    A.HAS_LINEAGE,
    -- Derived hierarchy fields (qualified name: default/snowflake/account/DATABASE/SCHEMA/TABLE/COLUMN)
    SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4) as database_name,
    SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5) as schema_name,
    SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 6) as table_name
FROM ATLAN_GOLD.PUBLIC.ASSETS A
WHERE A.STATUS = 'ACTIVE'
  AND UPPER(A.ASSET_TYPE) IN ('TABLE', 'VIEW', 'MATERIALIZEDVIEW')
  {connector_filter}
  {database_filter}
  {schema_filter}
ORDER BY A.POPULARITY_SCORE DESC NULLS LAST, A.UPDATED_AT DESC
LIMIT {limit}
OFFSET {offset}
"""


@router.get("/hierarchy/connectors")
@handle_mdlh_errors
async def get_hierarchy_connectors(
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get list of connectors with asset counts for hierarchy navigation.
    """
    results = service.execute_query(SQL_HIERARCHY_CONNECTORS)

    connectors = [
        HierarchyItem(
            name=row.get("CONNECTOR_NAME", "Unknown"),
            asset_count=row.get("ASSET_COUNT", 0),
        )
        for row in results
        if row.get("CONNECTOR_NAME")
    ]

    return {"connectors": [c.model_dump() for c in connectors]}


@router.get("/hierarchy/databases")
@handle_mdlh_errors
async def get_hierarchy_databases(
    connector: str,
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get list of databases for a connector with asset counts.
    Derived from first segment of ASSET_QUALIFIED_NAME.
    """
    results = service.execute_query(
        SQL_HIERARCHY_DATABASES,
        params={"connector": connector},
    )

    databases = [
        HierarchyItem(
            name=row.get("DATABASE_NAME", "Unknown"),
            asset_count=row.get("ASSET_COUNT", 0),
            sample_guid=row.get("SAMPLE_GUID"),
        )
        for row in results
        if row.get("DATABASE_NAME")
    ]

    return {"databases": [d.model_dump() for d in databases], "connector": connector}


@router.get("/hierarchy/schemas")
@handle_mdlh_errors
async def get_hierarchy_schemas(
    connector: str,
    database: str,
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get list of schemas for a database with asset counts.
    Derived from second segment of ASSET_QUALIFIED_NAME.
    """
    results = service.execute_query(
        SQL_HIERARCHY_SCHEMAS,
        params={"connector": connector, "database": database},
    )

    schemas = [
        HierarchyItem(
            name=row.get("SCHEMA_NAME", "Unknown"),
            asset_count=row.get("ASSET_COUNT", 0),
            sample_guid=row.get("SAMPLE_GUID"),
        )
        for row in results
        if row.get("SCHEMA_NAME")
    ]

    return {
        "schemas": [s.model_dump() for s in schemas],
        "connector": connector,
        "database": database,
    }


# Schema model for the /schemas endpoint
class SchemaInfo(BaseModel):
    """Schema information for assessment scope selection."""
    name: str
    database_name: str
    connector_name: str
    qualified_name: str
    asset_count: int = 0


@router.get("/schemas")
@handle_mdlh_errors
async def get_all_schemas(
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get all schemas across all databases for assessment scope selection.

    NOTE: Filtering by ASSET_TYPE requires a Snowflake warehouse with compute.
    This endpoint returns schema counts by connector as a fallback when detailed
    schema listing is not available without compute.

    To get full schema details, ensure your Snowflake warehouse is active and
    has AUTO_RESUME enabled.
    """
    # First try the full query with ASSET_TYPE filter (requires warehouse compute)
    sql_with_filter = """
SELECT
    GUID,
    ASSET_NAME,
    ASSET_QUALIFIED_NAME,
    CONNECTOR_NAME
FROM ATLAN_GOLD.PUBLIC.ASSETS
WHERE STATUS = 'ACTIVE' AND CONNECTOR_NAME IS NOT NULL AND ASSET_TYPE = 'Schema'
ORDER BY CONNECTOR_NAME, ASSET_NAME
LIMIT 1000
"""
    try:
        results = service.execute_query(sql_with_filter)

        # Parse results
        schemas = []
        for row in results:
            schema_name = row.get("ASSET_NAME")
            if not schema_name:
                continue

            qualified_name = row.get("ASSET_QUALIFIED_NAME", "")
            connector_name = row.get("CONNECTOR_NAME", "unknown")

            # Extract database name from qualified_name
            parts = qualified_name.split("/") if qualified_name else []
            database_name = parts[3] if len(parts) > 3 else "Unknown"

            schemas.append(SchemaInfo(
                name=schema_name,
                database_name=database_name,
                connector_name=connector_name,
                qualified_name=qualified_name,
                asset_count=0,
            ))

        return {
            "schemas": [s.model_dump() for s in schemas],
            "total": len(schemas),
        }

    except Exception as e:
        error_msg = str(e)
        if "No active warehouse" in error_msg:
            # Warehouse not available - return informative error
            logger.warning(f"Schemas query requires warehouse compute: {e}")
            raise HTTPException(
                status_code=503,
                detail="Schema listing requires an active Snowflake warehouse. "
                       "Your warehouse may be suspended or not configured. "
                       "Use the /api/mdlh/connectors endpoint for data that doesn't require compute."
            )
        logger.error(f"Error executing schemas query: {e}")
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


@router.get("/hierarchy/tables")
@handle_mdlh_errors
async def get_hierarchy_tables(
    connector: str,
    database: str,
    schema: str,
    limit: int = Query(500, ge=1, le=2000),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get list of tables/views within a schema.
    """
    results = service.execute_query(
        SQL_HIERARCHY_TABLES,
        params={
            "connector": connector,
            "database": database,
            "schema": schema,
            "limit": limit,
        },
    )

    tables = [
        TableItem(
            guid=row.get("GUID", ""),
            name=row.get("ASSET_NAME", "Unknown"),
            asset_type=row.get("ASSET_TYPE", "Table"),
            qualified_name=row.get("ASSET_QUALIFIED_NAME", ""),
            description=row.get("DESCRIPTION"),
            certificate_status=row.get("CERTIFICATE_STATUS"),
            has_lineage=row.get("HAS_LINEAGE", False) or False,
            popularity_score=row.get("POPULARITY_SCORE"),
            owner_users=parse_json_array(row.get("OWNER_USERS")),
            tags=parse_json_array(row.get("TAGS")),
            updated_at=row.get("UPDATED_AT"),
        )
        for row in results
        if row.get("GUID")
    ]

    return {
        "tables": [t.model_dump() for t in tables],
        "connector": connector,
        "database": database,
        "schema": schema,
        "count": len(tables),
    }


@router.get("/asset/{guid}")
@handle_mdlh_errors
async def get_asset_detail(
    guid: str,
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get full details for a single asset by GUID.
    """
    result = service.execute_query_single(
        SQL_ASSET_DETAIL,
        params={"guid": guid},
    )

    if not result:
        raise HTTPException(status_code=404, detail=f"Asset not found: {guid}")

    asset = AssetDetail(
        guid=result.get("GUID", ""),
        name=result.get("ASSET_NAME", "Unknown"),
        asset_type=result.get("ASSET_TYPE", "Unknown"),
        qualified_name=result.get("ASSET_QUALIFIED_NAME", ""),
        connector_name=result.get("CONNECTOR_NAME"),
        connector_qualified_name=result.get("CONNECTOR_QUALIFIED_NAME"),
        description=result.get("DESCRIPTION"),
        certificate_status=result.get("CERTIFICATE_STATUS"),
        has_lineage=result.get("HAS_LINEAGE", False) or False,
        popularity_score=result.get("POPULARITY_SCORE"),
        owner_users=result.get("OWNER_USERS"),
        tags=result.get("TAGS"),
        term_guids=result.get("TERM_GUIDS"),
        readme_guid=result.get("README_GUID"),
        updated_at=result.get("UPDATED_AT"),
        source_updated_at=result.get("SOURCE_UPDATED_AT"),
        created_at=result.get("CREATED_AT"),
        created_by=result.get("CREATED_BY"),
        updated_by=result.get("UPDATED_BY"),
        status=result.get("STATUS"),
        column_count=result.get("TABLE_COLUMN_COUNT"),
        row_count=result.get("TABLE_ROW_COUNT"),
        size_bytes=result.get("TABLE_SIZE_BYTES"),
        read_count=result.get("TABLE_TOTAL_READ_COUNT"),
        database_name=result.get("DATABASE_NAME"),
        schema_name=result.get("SCHEMA_NAME"),
    )

    return {"asset": asset.model_dump()}


@router.get("/hierarchy/assets")
@handle_mdlh_errors
async def get_hierarchy_assets(
    connector: str | None = None,
    database: str | None = None,
    schema: str | None = None,
    limit: int = Query(1000, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    DEPRECATED: Use /assets endpoint instead with database/schema filters.

    Example: GET /assets?connector=snowflake&database=MYDB&schema=PUBLIC

    Get assets within a hierarchy context (connection, database, or schema).
    Used for loading assets for quality scoring.
    """
    # Build parameterized query to prevent SQL injection
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    conditions = ["A.STATUS = 'ACTIVE'", "A.ASSET_TYPE IN ('Table', 'View', 'MaterializedView')"]

    if connector:
        conditions.append("A.CONNECTOR_NAME = %(connector)s")
        params["connector"] = connector
    if database:
        conditions.append("SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4) = %(database)s")
        params["database"] = database
    if schema:
        conditions.append("SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5) = %(schema)s")
        params["schema"] = schema

    where_clause = " AND ".join(conditions)

    sql = f"""
    SELECT
        A.GUID,
        A.ASSET_NAME,
        A.ASSET_TYPE,
        A.ASSET_QUALIFIED_NAME,
        A.CONNECTOR_NAME,
        A.DESCRIPTION,
        A.CERTIFICATE_STATUS,
        A.HAS_LINEAGE,
        A.POPULARITY_SCORE,
        A.OWNER_USERS,
        A.TAGS,
        A.TERM_GUIDS,
        A.README_GUID,
        A.UPDATED_AT,
        A.SOURCE_UPDATED_AT,
        SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4) as database_name,
        SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5) as schema_name,
        SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 6) as table_name
    FROM ATLAN_GOLD.PUBLIC.ASSETS A
    WHERE {where_clause}
    ORDER BY A.POPULARITY_SCORE DESC NULLS LAST, A.UPDATED_AT DESC
    LIMIT %(limit)s
    OFFSET %(offset)s
    """

    results = service.execute_query(sql, params=params)

    # Also get total count for pagination (using same parameterized conditions)
    count_sql = f"""
    SELECT COUNT(*) as total_count
    FROM ATLAN_GOLD.PUBLIC.ASSETS A
    WHERE {where_clause}
    """
    count_result = service.execute_query_single(count_sql, params=params)
    total_count = count_result.get("TOTAL_COUNT", 0) if count_result else 0

    return {
        "assets": results,
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "filters": {
            "connector": connector,
            "database": database,
            "schema": schema,
        },
    }


# ============================================
# LINEAGE METRICS ENDPOINTS
# ============================================


class LineageMetricsResult(BaseModel):
    """Lineage metrics for an asset."""

    guid: str
    asset_name: str
    asset_type: str
    connector_name: str | None
    has_upstream: bool
    has_downstream: bool
    has_lineage: bool
    full_lineage: bool
    orphaned: bool
    upstream_count: int
    downstream_count: int


class LineageRollupResult(BaseModel):
    """Aggregated lineage metrics for a dimension."""

    dimension_value: str
    total_assets: int
    pct_has_upstream: float
    pct_has_downstream: float
    pct_with_lineage: float
    pct_full_lineage: float
    pct_orphaned: float


@router.get("/lineage-metrics")
@handle_mdlh_errors
async def get_lineage_metrics(
    asset_type: AssetType = AssetType.ALL,
    connector: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get lineage metrics (upstream/downstream breakdown) for assets.

    Returns has_upstream, has_downstream, full_lineage, orphaned flags
    computed from the LINEAGE view.
    """
    type_filter = ""
    if asset_type != AssetType.ALL:
        type_filter = f"AND A.ASSET_TYPE = '{asset_type.value}'"

    connector_filter = ""
    if connector:
        connector_filter = f"AND A.CONNECTOR_NAME = '{connector}'"

    sql = f"""
    {SQL_LINEAGE_METRICS}
    ORDER BY A.POPULARITY_SCORE DESC NULLS LAST
    LIMIT {limit}
    OFFSET {offset}
    """.format(type_filter=type_filter, connector_filter=connector_filter)

    # Fix the format - need to use .format() properly
    sql = SQL_LINEAGE_METRICS.format(
        type_filter=type_filter,
        connector_filter=connector_filter,
    ) + f"""
    ORDER BY A.POPULARITY_SCORE DESC NULLS LAST
    LIMIT {limit}
    OFFSET {offset}
    """

    results = service.execute_query(sql)

    metrics = [
        LineageMetricsResult(
            guid=row.get("GUID", ""),
            asset_name=row.get("ASSET_NAME", ""),
            asset_type=row.get("ASSET_TYPE", ""),
            connector_name=row.get("CONNECTOR_NAME"),
            has_upstream=bool(row.get("HAS_UPSTREAM", 0)),
            has_downstream=bool(row.get("HAS_DOWNSTREAM", 0)),
            has_lineage=bool(row.get("HAS_LINEAGE", 0)),
            full_lineage=bool(row.get("FULL_LINEAGE", 0)),
            orphaned=bool(row.get("ORPHANED", 0)),
            upstream_count=row.get("UPSTREAM_COUNT", 0),
            downstream_count=row.get("DOWNSTREAM_COUNT", 0),
        )
        for row in results
    ]

    return {
        "metrics": [m.model_dump() for m in metrics],
        "limit": limit,
        "offset": offset,
    }


@router.get("/lineage-rollup")
@handle_mdlh_errors
async def get_lineage_rollup(
    dimension: PivotDimension = PivotDimension.CONNECTOR,
    asset_type: AssetType = AssetType.ALL,
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get aggregated lineage metrics by dimension.

    Returns pct_has_upstream, pct_has_downstream, pct_full_lineage, pct_orphaned
    grouped by the specified dimension.
    """
    # Qualified name structure: default/snowflake/account/DATABASE/SCHEMA/TABLE/COLUMN
    dimension_map = {
        PivotDimension.CONNECTOR: "A.CONNECTOR_NAME",
        PivotDimension.DATABASE: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4)",
        PivotDimension.SCHEMA: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5)",
        PivotDimension.ASSET_TYPE: "A.ASSET_TYPE",
        PivotDimension.CERTIFICATE_STATUS: "COALESCE(A.CERTIFICATE_STATUS, 'NONE')",
    }

    dimension_col = dimension_map.get(dimension, "A.CONNECTOR_NAME")

    asset_type_filter = ""
    if asset_type != AssetType.ALL:
        asset_type_filter = f"AND A.ASSET_TYPE = '{asset_type.value}'"

    sql = SQL_LINEAGE_ROLLUP.format(
        dimension=dimension_col,
        asset_type_filter=asset_type_filter,
    )

    results = service.execute_query(sql)

    rollups = [
        LineageRollupResult(
            dimension_value=row.get("DIMENSION_VALUE", "Unknown"),
            total_assets=row.get("TOTAL_ASSETS", 0),
            pct_has_upstream=round(row.get("PCT_HAS_UPSTREAM", 0), 2),
            pct_has_downstream=round(row.get("PCT_HAS_DOWNSTREAM", 0), 2),
            pct_with_lineage=round(row.get("PCT_WITH_LINEAGE", 0), 2),
            pct_full_lineage=round(row.get("PCT_FULL_LINEAGE", 0), 2),
            pct_orphaned=round(row.get("PCT_ORPHANED", 0), 2),
        )
        for row in results
    ]

    return {
        "dimension": dimension.value,
        "rollups": [r.model_dump() for r in rollups],
    }


# ============================================
# OWNER ENDPOINTS
# ============================================


@router.get("/owners")
@handle_mdlh_errors
async def get_owners(
    limit: int = Query(500, ge=1, le=1000),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get list of all owners with asset counts.

    Uses LATERAL FLATTEN to expand the OWNER_USERS array.
    """
    sql = SQL_LIST_OWNERS.replace("LIMIT 500", f"LIMIT {limit}")
    results = service.execute_query(sql)

    return {
        "owners": [
            {"owner_id": row.get("OWNER_ID"), "asset_count": row.get("ASSET_COUNT", 0)}
            for row in results
        ],
        "count": len(results),
    }


@router.get("/quality-rollup/by-owner")
@handle_mdlh_errors
async def get_quality_rollup_by_owner(
    asset_type: AssetType = AssetType.ALL,
    limit: int = Query(100, ge=1, le=500),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    DEPRECATED: Use /quality endpoint instead with dimension=owner.

    Example: GET /quality?dimension=owner&asset_type=Table

    Get quality scores aggregated by owner.
    Uses LATERAL FLATTEN to handle the OWNER_USERS array field.
    Assets with multiple owners appear in each owner's aggregation.
    """
    asset_type_filter = ""
    if asset_type != AssetType.ALL:
        asset_type_filter = f"AND A.ASSET_TYPE = '{asset_type.value}'"

    sql = SQL_QUALITY_ROLLUP_BY_OWNER.format(
        asset_type_filter=asset_type_filter,
    ) + f"\nLIMIT {limit}"

    results = service.execute_query(sql)

    # Calculate overall score for each rollup
    for row in results:
        overall = (
            row.get("AVG_COMPLETENESS", 0) * 0.25 +
            row.get("AVG_ACCURACY", 0) * 0.20 +
            row.get("AVG_TIMELINESS", 0) * 0.20 +
            row.get("AVG_CONSISTENCY", 0) * 0.15 +
            row.get("AVG_USABILITY", 0) * 0.20
        )
        row["AVG_OVERALL"] = round(overall, 2)

    return {
        "dimension": "owner",
        "rollups": results,
    }


# ============================================
# TIME SERIES / TRENDS ENDPOINTS
# ============================================


class SnapshotResult(BaseModel):
    """Quality snapshot for a point in time."""

    snapshot_date: str
    dimension_value: str
    total_assets: int
    avg_completeness: float
    avg_accuracy: float
    avg_timeliness: float
    avg_consistency: float
    avg_usability: float
    avg_overall: float
    pct_with_description: float
    pct_with_owner: float
    pct_with_tags: float
    pct_certified: float
    pct_with_lineage: float
    pct_with_readme: float = 0.0  # README documentation present
    pct_with_terms: float = 0.0  # Glossary terms linked


@router.get("/snapshot")
@handle_mdlh_errors
async def get_current_snapshot(
    dimension: PivotDimension = PivotDimension.CONNECTOR,
    asset_type: AssetType = AssetType.ALL,
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get a current-state quality snapshot.

    This captures the current quality metrics for all assets,
    suitable for storing as a historical data point.
    """
    # Qualified name structure: default/snowflake/account/DATABASE/SCHEMA/TABLE/COLUMN
    dimension_map = {
        PivotDimension.CONNECTOR: "A.CONNECTOR_NAME",
        PivotDimension.DATABASE: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4)",
        PivotDimension.SCHEMA: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5)",
        PivotDimension.ASSET_TYPE: "A.ASSET_TYPE",
        PivotDimension.CERTIFICATE_STATUS: "COALESCE(A.CERTIFICATE_STATUS, 'NONE')",
    }

    dimension_col = dimension_map.get(dimension, "A.CONNECTOR_NAME")

    asset_type_filter = ""
    if asset_type != AssetType.ALL:
        asset_type_filter = f"AND A.ASSET_TYPE = '{asset_type.value}'"

    # Simplified snapshot query (the full one has OBJECT_AGG issues)
    sql = f"""
    SELECT
        CURRENT_DATE() AS snapshot_date,
        {dimension_col} AS dimension_value,
        COUNT(*) AS total_assets,

        AVG(
            (CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 ELSE 0 END +
             CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL THEN 1 ELSE 0 END +
             CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END +
             0 + CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END
            ) / 8.0 * 100
        ) AS avg_completeness,

        AVG(
            (CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[\\w\\-\\.]+$') THEN 1 ELSE 0 END +
             CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL THEN 1 ELSE 0 END +
             CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
             1
            ) / 5.0 * 100
        ) AS avg_accuracy,

        AVG(
            CASE WHEN DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, A.UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90
            THEN 100.0 ELSE 0.0 END
        ) AS avg_timeliness,

        AVG(
            (CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 2 THEN 1 ELSE 0 END +
             CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END
            ) / 4.0 * 100
        ) AS avg_consistency,

        AVG(
            (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
             CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
             1
            ) / 3.0 * 100
        ) AS avg_usability,

        AVG(CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_description,
        AVG(CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_owner,
        AVG(CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_tags,
        AVG(CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1.0 ELSE 0.0 END) * 100 AS pct_certified,
        AVG(CASE WHEN A.HAS_LINEAGE = TRUE THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_lineage

    FROM ATLAN_GOLD.PUBLIC.ASSETS A
    LEFT JOIN ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS R ON A.GUID = R.GUID
    WHERE A.STATUS = 'ACTIVE'
    {asset_type_filter}
    GROUP BY {dimension_col}
    ORDER BY total_assets DESC
    """

    results = service.execute_query(sql)

    # Calculate overall score
    snapshots = []
    for row in results:
        overall = (
            row.get("AVG_COMPLETENESS", 0) * 0.25 +
            row.get("AVG_ACCURACY", 0) * 0.20 +
            row.get("AVG_TIMELINESS", 0) * 0.20 +
            row.get("AVG_CONSISTENCY", 0) * 0.15 +
            row.get("AVG_USABILITY", 0) * 0.20
        )
        snapshots.append(
            SnapshotResult(
                snapshot_date=str(row.get("SNAPSHOT_DATE", "")),
                dimension_value=row.get("DIMENSION_VALUE", "Unknown"),
                total_assets=row.get("TOTAL_ASSETS", 0),
                avg_completeness=round(row.get("AVG_COMPLETENESS", 0), 2),
                avg_accuracy=round(row.get("AVG_ACCURACY", 0), 2),
                avg_timeliness=round(row.get("AVG_TIMELINESS", 0), 2),
                avg_consistency=round(row.get("AVG_CONSISTENCY", 0), 2),
                avg_usability=round(row.get("AVG_USABILITY", 0), 2),
                avg_overall=round(overall, 2),
                pct_with_description=round(row.get("PCT_WITH_DESCRIPTION", 0), 2),
                pct_with_owner=round(row.get("PCT_WITH_OWNER", 0), 2),
                pct_with_tags=round(row.get("PCT_WITH_TAGS", 0), 2),
                pct_certified=round(row.get("PCT_CERTIFIED", 0), 2),
                pct_with_lineage=round(row.get("PCT_WITH_LINEAGE", 0), 2),
            )
        )

    return {
        "dimension": dimension.value,
        "snapshot_date": str(results[0].get("SNAPSHOT_DATE", "")) if results else None,
        "snapshots": [s.model_dump() for s in snapshots],
    }


@router.get("/trends/coverage")
@handle_mdlh_errors
async def get_coverage_trends(
    days: int = Query(30, ge=1, le=365),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get coverage trends over time based on asset modification timestamps.

    NOTE: This is an approximation - it shows when assets were last modified,
    not historical snapshots. For true time series, implement snapshot storage.
    """
    sql = f"""
    SELECT
        DATE_TRUNC('day', TO_TIMESTAMP(COALESCE(A.UPDATED_AT, A.SOURCE_UPDATED_AT, 0)/1000)) AS trend_date,
        COUNT(*) AS assets_modified,
        AVG(CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_description,
        AVG(CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_owner,
        AVG(CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_tags,
        AVG(CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1.0 ELSE 0.0 END) * 100 AS pct_certified,
        AVG(CASE WHEN A.HAS_LINEAGE = TRUE THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_lineage
    FROM ATLAN_GOLD.PUBLIC.ASSETS A
    WHERE A.STATUS = 'ACTIVE'
      AND TO_TIMESTAMP(COALESCE(A.UPDATED_AT, A.SOURCE_UPDATED_AT, 0)/1000) >= DATEADD('day', -{days}, CURRENT_TIMESTAMP())
      AND TO_TIMESTAMP(COALESCE(A.UPDATED_AT, A.SOURCE_UPDATED_AT, 0)/1000) <= CURRENT_TIMESTAMP()
    GROUP BY DATE_TRUNC('day', TO_TIMESTAMP(COALESCE(A.UPDATED_AT, A.SOURCE_UPDATED_AT, 0)/1000))
    ORDER BY trend_date ASC
    """

    results = service.execute_query(sql)

    return {
        "days": days,
        "data_points": len(results),
        "trends": [
            {
                "date": str(row.get("TREND_DATE", ""))[:10] if row.get("TREND_DATE") else None,
                "assets_modified": row.get("ASSETS_MODIFIED", 0),
                "pct_with_description": round(row.get("PCT_WITH_DESCRIPTION", 0), 2),
                "pct_with_owner": round(row.get("PCT_WITH_OWNER", 0), 2),
                "pct_with_tags": round(row.get("PCT_WITH_TAGS", 0), 2),
                "pct_certified": round(row.get("PCT_CERTIFIED", 0), 2),
                "pct_with_lineage": round(row.get("PCT_WITH_LINEAGE", 0), 2),
            }
            for row in results
        ],
        "note": "This shows coverage of assets modified during each period, not historical snapshots.",
    }


# ============================================
# ENHANCED SEARCH ENDPOINT (DEPRECATED)
# ============================================


@router.get("/search")
@handle_mdlh_errors
async def enhanced_search(
    query: str,
    asset_type: AssetType = AssetType.ALL,
    connector: str | None = None,
    include_tags: bool = True,
    limit: int = Query(50, ge=1, le=500),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    DEPRECATED: Use /assets endpoint instead with query parameter.

    Example: GET /assets?query=customer&include_tags=true&connector=snowflake

    Enhanced search with relevance scoring.
    Searches asset names, descriptions, and optionally tags.
    Results are ranked by relevance score.
    """
    # Escape single quotes in query
    safe_query = query.replace("'", "''")

    type_filter = ""
    if asset_type != AssetType.ALL:
        type_filter = f"AND A.ASSET_TYPE = '{asset_type.value}'"

    connector_filter = ""
    if connector:
        connector_filter = f"AND A.CONNECTOR_NAME = '{connector}'"

    tag_search = ""
    if include_tags:
        tag_search = f"OR EXISTS (SELECT 1 FROM TABLE(FLATTEN(A.TAGS)) t WHERE t.VALUE::STRING ILIKE '%{safe_query}%')"

    sql = f"""
    SELECT
        A.GUID,
        A.ASSET_NAME,
        A.ASSET_TYPE,
        A.ASSET_QUALIFIED_NAME,
        A.DESCRIPTION,
        A.CONNECTOR_NAME,
        A.CERTIFICATE_STATUS,
        A.HAS_LINEAGE,
        A.POPULARITY_SCORE,
        A.OWNER_USERS,
        A.TAGS,
        A.UPDATED_AT,
        -- Relevance scoring
        CASE
            WHEN LOWER(A.ASSET_NAME) = LOWER('{safe_query}') THEN 100
            WHEN LOWER(A.ASSET_NAME) LIKE LOWER('{safe_query}') || '%' THEN 80
            WHEN LOWER(A.ASSET_NAME) LIKE '%' || LOWER('{safe_query}') || '%' THEN 60
            WHEN LOWER(A.DESCRIPTION) LIKE '%' || LOWER('{safe_query}') || '%' THEN 40
            ELSE 20
        END AS relevance_score
    FROM ATLAN_GOLD.PUBLIC.ASSETS A
    WHERE A.STATUS = 'ACTIVE'
      {type_filter}
      {connector_filter}
      AND (
        A.ASSET_NAME ILIKE '%{safe_query}%'
        OR A.DESCRIPTION ILIKE '%{safe_query}%'
        {tag_search}
      )
    ORDER BY relevance_score DESC, A.POPULARITY_SCORE DESC NULLS LAST
    LIMIT {limit}
    """

    results = service.execute_query(sql)

    return {
        "query": query,
        "results": results,
        "count": len(results),
        "filters": {
            "asset_type": asset_type.value if asset_type != AssetType.ALL else None,
            "connector": connector,
            "include_tags": include_tags,
        },
    }


# ============================================
# SCHEMA INTROSPECTION ENDPOINTS
# ============================================
# These endpoints support MDLH field reconciliation by introspecting
# the actual Snowflake schema and comparing to expected field mappings.


class MdlhSchemaColumn(BaseModel):
    """Schema column metadata from INFORMATION_SCHEMA."""

    table_name: str
    column_name: str
    data_type: str
    is_nullable: bool
    comment: str | None = None


class FieldReconciliation(BaseModel):
    """Result of reconciling a field against the MDLH schema."""

    field_id: str
    field_name: str
    category: str
    expected_mdlh_column: str | None
    expected_mdlh_table: str | None
    actual_column: MdlhSchemaColumn | None
    status: str  # 'available', 'missing', 'type_mismatch', 'no_mapping'


class ReconciliationSummary(BaseModel):
    """Summary of schema reconciliation results."""

    total_expected: int
    available: int
    missing: int
    type_mismatch: int
    no_mapping: int
    by_category: dict[str, dict[str, int]]
    by_table: dict[str, dict[str, int]]


class MdlhSchemaResult(BaseModel):
    """Complete schema introspection result."""

    discovered_at: str
    columns: list[MdlhSchemaColumn]
    reconciliation: list[FieldReconciliation]
    summary: ReconciliationSummary


# SQL to fetch schema metadata from INFORMATION_SCHEMA
SQL_SCHEMA_COLUMNS = """
SELECT
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COMMENT
FROM ATLAN_GOLD.INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'PUBLIC'
ORDER BY TABLE_NAME, ORDINAL_POSITION
"""

# Known field mappings from unified-fields.ts
# This maps canonical field IDs to their MDLH column and table
FIELD_MDLH_MAPPINGS = {
    'owner_users': {'column': 'OWNER_USERS', 'table': 'ASSETS'},
    'owner_groups': {'column': 'OWNER_GROUPS', 'table': 'ASSETS'},  # NOTE: Missing in MDLH
    'description': {'column': 'DESCRIPTION', 'table': 'ASSETS'},
    'readme': {'column': 'README_GUID', 'table': 'ASSETS'},
    'glossary_terms': {'column': 'TERM_GUIDS', 'table': 'ASSETS'},
    'has_lineage': {'column': 'HAS_LINEAGE', 'table': 'ASSETS'},
    'classifications': {'column': 'TAGS', 'table': 'ASSETS'},
    'certificate_status': {'column': 'CERTIFICATE_STATUS', 'table': 'ASSETS'},
    'popularity_score': {'column': 'POPULARITY_SCORE', 'table': 'ASSETS'},
    'created_at': {'column': 'CREATED_AT', 'table': 'ASSETS'},
    'updated_at': {'column': 'UPDATED_AT', 'table': 'ASSETS'},
    'created_by': {'column': 'CREATED_BY', 'table': 'ASSETS'},
    'updated_by': {'column': 'UPDATED_BY', 'table': 'ASSETS'},
    'certificate_updated_at': {'column': 'CERTIFICATE_UPDATED_AT', 'table': 'ASSETS'},
    'certificate_updated_by': {'column': 'CERTIFICATE_UPDATED_BY', 'table': 'ASSETS'},
    'source_created_at': {'column': 'SOURCE_CREATED_AT', 'table': 'ASSETS'},
    'source_updated_at': {'column': 'SOURCE_UPDATED_AT', 'table': 'ASSETS'},
    'connector_name': {'column': 'CONNECTOR_NAME', 'table': 'ASSETS'},
    'connector_qualified_name': {'column': 'CONNECTOR_QUALIFIED_NAME', 'table': 'ASSETS'},
    # Relational asset details
    'column_count': {'column': 'TABLE_COLUMN_COUNT', 'table': 'RELATIONAL_ASSET_DETAILS'},
    'row_count': {'column': 'TABLE_ROW_COUNT', 'table': 'RELATIONAL_ASSET_DETAILS'},
    'size_bytes': {'column': 'TABLE_SIZE_BYTES', 'table': 'RELATIONAL_ASSET_DETAILS'},
    'read_count': {'column': 'TABLE_TOTAL_READ_COUNT', 'table': 'RELATIONAL_ASSET_DETAILS'},
}

# Field categories for grouping
FIELD_CATEGORIES = {
    'owner_users': 'ownership',
    'owner_groups': 'ownership',
    'description': 'documentation',
    'readme': 'documentation',
    'glossary_terms': 'documentation',
    'has_lineage': 'lineage',
    'classifications': 'classification',
    'certificate_status': 'governance',
    'popularity_score': 'usage',
    'created_at': 'lifecycle',
    'updated_at': 'lifecycle',
    'created_by': 'lifecycle',
    'updated_by': 'lifecycle',
    'certificate_updated_at': 'lifecycle',
    'certificate_updated_by': 'lifecycle',
    'source_created_at': 'lifecycle',
    'source_updated_at': 'lifecycle',
    'connector_name': 'hierarchy',
    'connector_qualified_name': 'hierarchy',
    'column_count': 'statistics',
    'row_count': 'statistics',
    'size_bytes': 'statistics',
    'read_count': 'usage',
}


@router.get("/schema")
@handle_mdlh_errors
async def get_mdlh_schema(
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get MDLH Gold Layer schema metadata.

    Returns all columns from ATLAN_GOLD.PUBLIC tables/views with their
    data types and nullability information.
    """
    from datetime import datetime

    results = service.execute_query(SQL_SCHEMA_COLUMNS)

    columns = [
        MdlhSchemaColumn(
            table_name=row.get("TABLE_NAME", ""),
            column_name=row.get("COLUMN_NAME", ""),
            data_type=row.get("DATA_TYPE", ""),
            is_nullable=row.get("IS_NULLABLE", "YES") == "YES",
            comment=row.get("COMMENT"),
        )
        for row in results
    ]

    # Group by table for convenience
    by_table: dict[str, list[dict]] = {}
    for col in columns:
        if col.table_name not in by_table:
            by_table[col.table_name] = []
        by_table[col.table_name].append(col.model_dump())

    return {
        "discovered_at": datetime.utcnow().isoformat() + "Z",
        "columns": [c.model_dump() for c in columns],
        "column_count": len(columns),
        "tables": list(by_table.keys()),
        "table_count": len(by_table),
        "by_table": by_table,
    }


@router.get("/schema/reconcile")
@handle_mdlh_errors
async def reconcile_mdlh_schema(
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Reconcile expected field mappings against actual MDLH schema.

    Compares the fields defined in unified-fields.ts with their expected
    MDLH column mappings against the actual schema. Returns:
    - available: Column exists in MDLH schema
    - missing: Column does NOT exist in MDLH schema
    - type_mismatch: Column exists but type doesn't match expected
    - no_mapping: Field doesn't have an MDLH mapping defined
    """
    from datetime import datetime

    # Fetch actual schema
    results = service.execute_query(SQL_SCHEMA_COLUMNS)

    # Build lookup: (TABLE_NAME, COLUMN_NAME) -> column info
    schema_lookup: dict[tuple[str, str], MdlhSchemaColumn] = {}
    for row in results:
        key = (row.get("TABLE_NAME", ""), row.get("COLUMN_NAME", ""))
        schema_lookup[key] = MdlhSchemaColumn(
            table_name=row.get("TABLE_NAME", ""),
            column_name=row.get("COLUMN_NAME", ""),
            data_type=row.get("DATA_TYPE", ""),
            is_nullable=row.get("IS_NULLABLE", "YES") == "YES",
            comment=row.get("COMMENT"),
        )

    # Reconcile each known field
    reconciliation: list[FieldReconciliation] = []
    summary = {
        'total_expected': 0,
        'available': 0,
        'missing': 0,
        'type_mismatch': 0,
        'no_mapping': 0,
    }
    by_category: dict[str, dict[str, int]] = {}
    by_table: dict[str, dict[str, int]] = {}

    for field_id, mapping in FIELD_MDLH_MAPPINGS.items():
        expected_column = mapping['column']
        expected_table = mapping['table']
        category = FIELD_CATEGORIES.get(field_id, 'other')

        # Initialize category stats if needed
        if category not in by_category:
            by_category[category] = {'expected': 0, 'available': 0, 'missing': 0}
        if expected_table not in by_table:
            by_table[expected_table] = {'expected': 0, 'available': 0, 'missing': 0}

        summary['total_expected'] += 1
        by_category[category]['expected'] += 1
        by_table[expected_table]['expected'] += 1

        # Check if column exists in actual schema
        lookup_key = (expected_table, expected_column)
        actual_column = schema_lookup.get(lookup_key)

        if actual_column:
            status = 'available'
            summary['available'] += 1
            by_category[category]['available'] += 1
            by_table[expected_table]['available'] += 1
        else:
            status = 'missing'
            summary['missing'] += 1
            by_category[category]['missing'] += 1
            by_table[expected_table]['missing'] += 1

        reconciliation.append(FieldReconciliation(
            field_id=field_id,
            field_name=field_id.replace('_', ' ').title(),
            category=category,
            expected_mdlh_column=expected_column,
            expected_mdlh_table=expected_table,
            actual_column=actual_column,
            status=status,
        ))

    return {
        "discovered_at": datetime.utcnow().isoformat() + "Z",
        "reconciliation": [r.model_dump() for r in reconciliation],
        "summary": {
            **summary,
            "by_category": by_category,
            "by_table": by_table,
        },
    }


# ============================================
# COMPLETENESS & ENRICHMENT TRACKING
# ============================================
# These endpoints track metadata completeness and enrichment
# including CUSTOM_METADATA attributes (e.g., AI Readiness)

SQL_COMPLETENESS_STATS = """
-- Completeness and enrichment stats by asset type
-- Joins ASSETS with CUSTOM_METADATA to count CM property enrichment
WITH cm_stats AS (
    SELECT
        alt.guid as asset_guid,
        SUM(
            CASE
                WHEN cm.attribute_value IS NULL THEN 0
                WHEN IS_ARRAY(TRY_PARSE_JSON(cm.attribute_value)) THEN
                    CASE WHEN ARRAY_SIZE(TRY_PARSE_JSON(cm.attribute_value)) > 0 THEN 1 ELSE 0 END
                WHEN TYPEOF(TRY_PARSE_JSON(cm.attribute_value)) <> 'ARRAY' AND cm.attribute_value IS NOT NULL THEN 1
                ELSE 0
            END
        ) as linked_cm_prop_count,
        COUNT(DISTINCT cm.custom_metadata_name) as distinct_cm_count
    FROM ATLAN_GOLD.PUBLIC.ASSETS alt
    LEFT JOIN ATLAN_GOLD.PUBLIC.CUSTOM_METADATA cm ON alt.guid = cm.asset_guid
    WHERE alt.STATUS = 'ACTIVE'
    {cm_filter}
    GROUP BY alt.guid
)
SELECT
    A.ASSET_TYPE as asset_type,
    COUNT(*) AS total_count,

    -- Description stats
    COUNT(CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 END) AS with_description,
    COUNT(CASE WHEN A.DESCRIPTION IS NULL OR TRIM(A.DESCRIPTION) = '' THEN 1 END) AS without_description,

    -- Certificate stats
    COUNT(CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1 END) AS certified,
    COUNT(CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) != 'VERIFIED' OR A.CERTIFICATE_STATUS IS NULL THEN 1 END) AS uncertified,

    -- Tags stats
    COUNT(CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 END) AS with_tags,
    COUNT(CASE WHEN A.TAGS IS NULL OR ARRAY_SIZE(A.TAGS) = 0 THEN 1 END) AS without_tags,

    -- Owner stats
    COUNT(CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 END) AS with_owners,
    COUNT(CASE WHEN A.OWNER_USERS IS NULL OR ARRAY_SIZE(A.OWNER_USERS) = 0 THEN 1 END) AS without_owners,

    -- Glossary terms stats
    COUNT(CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 END) AS with_terms,
    COUNT(CASE WHEN A.TERM_GUIDS IS NULL OR ARRAY_SIZE(A.TERM_GUIDS) = 0 THEN 1 END) AS without_terms,

    -- README stats
    COUNT(CASE WHEN A.README_GUID IS NOT NULL THEN 1 END) AS with_readme,
    COUNT(CASE WHEN A.README_GUID IS NULL THEN 1 END) AS without_readme,

    -- Lineage stats
    COUNT(CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 END) AS with_lineage,
    COUNT(CASE WHEN A.HAS_LINEAGE = FALSE OR A.HAS_LINEAGE IS NULL THEN 1 END) AS without_lineage,

    -- Custom Metadata enrichment stats
    COUNT(CASE WHEN COALESCE(cm.linked_cm_prop_count, 0) > 0 THEN 1 END) AS with_custom_metadata,
    COUNT(CASE WHEN COALESCE(cm.linked_cm_prop_count, 0) = 0 THEN 1 END) AS without_custom_metadata,

    -- Overall enrichment score (out of 8 checks)
    AVG(
        (CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1.0 ELSE 0.0 END +
         CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1.0 ELSE 0.0 END +
         CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1.0 ELSE 0.0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1.0 ELSE 0.0 END +
         CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1.0 ELSE 0.0 END +
         CASE WHEN A.README_GUID IS NOT NULL THEN 1.0 ELSE 0.0 END +
         CASE WHEN A.HAS_LINEAGE = TRUE THEN 1.0 ELSE 0.0 END +
         CASE WHEN COALESCE(cm.linked_cm_prop_count, 0) > 0 THEN 1.0 ELSE 0.0 END
        ) / 8.0 * 100
    ) AS avg_enrichment_score

FROM ATLAN_GOLD.PUBLIC.ASSETS A
LEFT JOIN cm_stats cm ON A.guid = cm.asset_guid
WHERE A.STATUS = 'ACTIVE'
{asset_type_filter}
{connector_filter}
{database_filter}
{schema_filter}
GROUP BY A.ASSET_TYPE
ORDER BY A.ASSET_TYPE
"""


class CompletenessStats(BaseModel):
    """Completeness statistics for an asset type."""

    asset_type: str
    total_count: int
    with_description: int
    without_description: int
    certified: int
    uncertified: int
    with_tags: int
    without_tags: int
    with_owners: int
    without_owners: int
    with_terms: int
    without_terms: int
    with_readme: int
    without_readme: int
    with_lineage: int
    without_lineage: int
    with_custom_metadata: int
    without_custom_metadata: int
    avg_enrichment_score: float


@router.get("/completeness")
@handle_mdlh_errors
async def get_completeness_stats(
    asset_types: str | None = Query(
        None,
        description="Comma-separated asset types (e.g., 'Table,Schema,View'). Default: Table,View,Schema"
    ),
    cm_names: str | None = Query(
        None,
        description="Comma-separated Custom Metadata names to check (e.g., 'AI Readiness,Data Quality'). Default: all CM"
    ),
    connector: str | None = Query(None, description="Filter by connector name"),
    database: str | None = Query(None, description="Filter by database name"),
    schema_name: str | None = Query(None, alias="schema", description="Filter by schema name"),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get metadata completeness and enrichment statistics by asset type.

    This endpoint provides a comprehensive view of:
    - Description coverage
    - Certification status
    - Tag coverage
    - Owner assignment
    - Glossary term linkage
    - README documentation
    - Lineage coverage
    - Custom Metadata enrichment (configurable by CM name)

    Use this to build governance and enrichment scorecards.
    """
    from datetime import datetime

    # Build asset type filter
    asset_type_list = ["Table", "View", "Schema"]  # defaults
    if asset_types:
        asset_type_list = [t.strip() for t in asset_types.split(",")]

    type_values = ", ".join(f"'{escape_sql_string(t)}'" for t in asset_type_list)
    asset_type_filter = f"AND A.ASSET_TYPE IN ({type_values})"

    # Build CM filter (for the cm_stats CTE)
    cm_filter = ""
    if cm_names:
        cm_name_list = [n.strip() for n in cm_names.split(",")]
        cm_values = ", ".join(f"'{escape_sql_string(n)}'" for n in cm_name_list)
        cm_filter = f"AND (cm.custom_metadata_name IS NULL OR cm.custom_metadata_name IN ({cm_values}))"

    # Build context filters
    connector_filter = ""
    if connector:
        connector_filter = f"AND A.CONNECTOR_NAME = '{escape_sql_string(connector)}'"

    database_filter = ""
    if database:
        database_filter = f"AND SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 4) = '{escape_sql_string(database)}'"

    schema_filter = ""
    if schema_name:
        schema_filter = f"AND SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 5) = '{escape_sql_string(schema_name)}'"

    sql = SQL_COMPLETENESS_STATS.format(
        cm_filter=cm_filter,
        asset_type_filter=asset_type_filter,
        connector_filter=connector_filter,
        database_filter=database_filter,
        schema_filter=schema_filter,
    )

    results = service.execute_query(sql)

    stats = []
    totals = {
        "total_count": 0,
        "with_description": 0,
        "without_description": 0,
        "certified": 0,
        "uncertified": 0,
        "with_tags": 0,
        "without_tags": 0,
        "with_owners": 0,
        "without_owners": 0,
        "with_terms": 0,
        "without_terms": 0,
        "with_readme": 0,
        "without_readme": 0,
        "with_lineage": 0,
        "without_lineage": 0,
        "with_custom_metadata": 0,
        "without_custom_metadata": 0,
    }

    for row in results:
        stat = CompletenessStats(
            asset_type=row.get("ASSET_TYPE", "Unknown"),
            total_count=row.get("TOTAL_COUNT", 0) or 0,
            with_description=row.get("WITH_DESCRIPTION", 0) or 0,
            without_description=row.get("WITHOUT_DESCRIPTION", 0) or 0,
            certified=row.get("CERTIFIED", 0) or 0,
            uncertified=row.get("UNCERTIFIED", 0) or 0,
            with_tags=row.get("WITH_TAGS", 0) or 0,
            without_tags=row.get("WITHOUT_TAGS", 0) or 0,
            with_owners=row.get("WITH_OWNERS", 0) or 0,
            without_owners=row.get("WITHOUT_OWNERS", 0) or 0,
            with_terms=row.get("WITH_TERMS", 0) or 0,
            without_terms=row.get("WITHOUT_TERMS", 0) or 0,
            with_readme=row.get("WITH_README", 0) or 0,
            without_readme=row.get("WITHOUT_README", 0) or 0,
            with_lineage=row.get("WITH_LINEAGE", 0) or 0,
            without_lineage=row.get("WITHOUT_LINEAGE", 0) or 0,
            with_custom_metadata=row.get("WITH_CUSTOM_METADATA", 0) or 0,
            without_custom_metadata=row.get("WITHOUT_CUSTOM_METADATA", 0) or 0,
            avg_enrichment_score=round(row.get("AVG_ENRICHMENT_SCORE", 0) or 0, 2),
        )
        stats.append(stat)

        # Accumulate totals
        for key in totals:
            totals[key] += getattr(stat, key)

    # Calculate overall enrichment score
    overall_enrichment = 0
    if totals["total_count"] > 0:
        overall_enrichment = round(
            (
                totals["with_description"] +
                totals["with_owners"] +
                totals["certified"] +
                totals["with_tags"] +
                totals["with_terms"] +
                totals["with_readme"] +
                totals["with_lineage"] +
                totals["with_custom_metadata"]
            ) / (totals["total_count"] * 8) * 100,
            2
        )

    return {
        "discovered_at": datetime.utcnow().isoformat() + "Z",
        "filters": {
            "asset_types": asset_type_list,
            "cm_names": cm_names.split(",") if cm_names else None,
            "connector": connector,
            "database": database,
            "schema": schema_name,
        },
        "stats": [s.model_dump() for s in stats],
        "totals": {
            **totals,
            "overall_enrichment_score": overall_enrichment,
        },
    }


# ============================================
# DEBUG ENDPOINTS FOR SCHEMA DISCOVERY
# ============================================

SQL_DEBUG_QUALIFIED_NAMES = """
-- Sample qualified names to understand structure
SELECT DISTINCT
    ASSET_TYPE,
    CONNECTOR_NAME,
    ASSET_QUALIFIED_NAME,
    SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 1) as segment_1,
    SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 2) as segment_2,
    SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 3) as segment_3,
    SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 4) as segment_4,
    SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 5) as segment_5,
    ARRAY_SIZE(SPLIT(ASSET_QUALIFIED_NAME, '/')) as segment_count
FROM ATLAN_GOLD.PUBLIC.ASSETS
WHERE STATUS = 'ACTIVE'
  AND ASSET_QUALIFIED_NAME IS NOT NULL
{connector_filter}
ORDER BY ASSET_TYPE, CONNECTOR_NAME
LIMIT 100
"""

SQL_MDLH_OBJECTS = """
-- List all tables and views in ATLAN_GOLD.PUBLIC
SELECT
    TABLE_NAME,
    TABLE_TYPE,
    ROW_COUNT,
    COMMENT
FROM ATLAN_GOLD.INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'PUBLIC'
ORDER BY TABLE_TYPE, TABLE_NAME
"""

SQL_ASSET_TYPE_STATS = """
-- Asset type distribution
SELECT
    ASSET_TYPE,
    CONNECTOR_NAME,
    COUNT(*) as asset_count,
    COUNT(DISTINCT SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 1)) as distinct_segment_1,
    COUNT(DISTINCT SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 2)) as distinct_segment_2,
    COUNT(DISTINCT SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 3)) as distinct_segment_3
FROM ATLAN_GOLD.PUBLIC.ASSETS
WHERE STATUS = 'ACTIVE'
GROUP BY ASSET_TYPE, CONNECTOR_NAME
ORDER BY asset_count DESC
"""


@router.get("/debug/qualified-names")
@handle_mdlh_errors
async def debug_qualified_names(
    connector: str | None = Query(None, description="Filter by connector name"),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Debug endpoint to examine qualified name structure.

    Returns sample qualified names and their parsed segments to help
    understand the DB >> Schema >> Table hierarchy structure.
    """
    connector_filter = ""
    if connector:
        connector_filter = f"AND CONNECTOR_NAME = '{escape_sql_string(connector)}'"

    sql = SQL_DEBUG_QUALIFIED_NAMES.format(connector_filter=connector_filter)
    results = service.execute_query(sql)

    samples = []
    for row in results:
        samples.append({
            "asset_type": row.get("ASSET_TYPE"),
            "connector": row.get("CONNECTOR_NAME"),
            "qualified_name": row.get("ASSET_QUALIFIED_NAME"),
            "segments": {
                "1": row.get("SEGMENT_1"),
                "2": row.get("SEGMENT_2"),
                "3": row.get("SEGMENT_3"),
                "4": row.get("SEGMENT_4"),
                "5": row.get("SEGMENT_5"),
            },
            "segment_count": row.get("SEGMENT_COUNT"),
        })

    return {
        "samples": samples,
        "count": len(samples),
        "note": "Use this to understand qualified name structure for hierarchy navigation",
    }


@router.get("/debug/mdlh-objects")
@handle_mdlh_errors
async def debug_mdlh_objects(
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    List all tables and views available in ATLAN_GOLD.PUBLIC.

    This shows what MDLH Gold Layer objects we can query.
    """
    results = service.execute_query(SQL_MDLH_OBJECTS)

    objects = []
    for row in results:
        objects.append({
            "name": row.get("TABLE_NAME"),
            "type": row.get("TABLE_TYPE"),
            "row_count": row.get("ROW_COUNT"),
            "comment": row.get("COMMENT"),
        })

    tables = [o for o in objects if o["type"] == "BASE TABLE"]
    views = [o for o in objects if o["type"] == "VIEW"]

    return {
        "tables": tables,
        "views": views,
        "total_tables": len(tables),
        "total_views": len(views),
    }


@router.get("/debug/asset-types")
@handle_mdlh_errors
async def debug_asset_types(
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get asset type distribution and segment analysis.

    Shows how many assets of each type exist and how their
    qualified names are structured.
    """
    results = service.execute_query(SQL_ASSET_TYPE_STATS)

    stats = []
    for row in results:
        stats.append({
            "asset_type": row.get("ASSET_TYPE"),
            "connector": row.get("CONNECTOR_NAME"),
            "count": row.get("ASSET_COUNT"),
            "distinct_segments": {
                "segment_1": row.get("DISTINCT_SEGMENT_1"),
                "segment_2": row.get("DISTINCT_SEGMENT_2"),
                "segment_3": row.get("DISTINCT_SEGMENT_3"),
            }
        })

    return {
        "stats": stats,
        "total_types": len(set(s["asset_type"] for s in stats)),
    }


# ============================================
# SCHEMA INTROSPECTION ENDPOINTS
# ============================================
# These endpoints allow discovering and validating the MDLH Gold Layer schema

SQL_GET_SCHEMA_COLUMNS = """
-- Discover available MDLH schema columns
SELECT
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COMMENT
FROM ATLAN_GOLD.INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'PUBLIC'
ORDER BY TABLE_NAME, ORDINAL_POSITION
"""


class MdlhSchemaColumn(BaseModel):
    """A column in the MDLH schema."""
    table_name: str
    column_name: str
    data_type: str
    is_nullable: bool
    comment: str | None = None


class MdlhSchemaResponse(BaseModel):
    """Response for MDLH schema endpoint."""
    columns: list[MdlhSchemaColumn]
    by_table: dict[str, list[MdlhSchemaColumn]]
    total_columns: int
    total_tables: int


class FieldReconciliation(BaseModel):
    """Reconciliation result for a single field."""
    field_id: str
    field_name: str
    category: str
    expected_mdlh_column: str | None
    expected_mdlh_table: str | None
    actual_mdlh_column: MdlhSchemaColumn | None = None
    status: str  # 'available', 'missing', 'type_mismatch', 'no_mapping'


class ReconciliationSummary(BaseModel):
    """Summary of schema reconciliation."""
    total_expected: int
    available: int
    missing: int
    no_mapping: int
    by_category: dict[str, dict[str, int]]
    by_table: dict[str, dict[str, int]]


class ReconciliationResponse(BaseModel):
    """Response for schema reconciliation endpoint."""
    reconciliations: list[FieldReconciliation]
    summary: ReconciliationSummary


# Expected MDLH field mappings (from unified-fields.ts)
EXPECTED_MDLH_FIELDS = {
    # Ownership
    'owner_users': {'column': 'OWNER_USERS', 'table': 'ASSETS', 'category': 'ownership'},
    'owner_groups': {'column': 'OWNER_GROUPS', 'table': 'ASSETS', 'category': 'ownership'},  # Known missing
    # Documentation
    'description': {'column': 'DESCRIPTION', 'table': 'ASSETS', 'category': 'documentation'},
    'readme': {'column': 'README_GUID', 'table': 'ASSETS', 'category': 'documentation'},
    'glossary_terms': {'column': 'TERM_GUIDS', 'table': 'ASSETS', 'category': 'documentation'},
    # Lineage
    'has_lineage': {'column': 'HAS_LINEAGE', 'table': 'ASSETS', 'category': 'lineage'},
    # Classification
    'classifications': {'column': 'TAGS', 'table': 'ASSETS', 'category': 'classification'},
    # Usage
    'popularity_score': {'column': 'POPULARITY_SCORE', 'table': 'ASSETS', 'category': 'usage'},
    # Governance
    'certificate_status': {'column': 'CERTIFICATE_STATUS', 'table': 'ASSETS', 'category': 'governance'},
    # Lifecycle
    'created_at': {'column': 'CREATED_AT', 'table': 'ASSETS', 'category': 'lifecycle'},
    'updated_at': {'column': 'UPDATED_AT', 'table': 'ASSETS', 'category': 'lifecycle'},
    'created_by': {'column': 'CREATED_BY', 'table': 'ASSETS', 'category': 'lifecycle'},
    'updated_by': {'column': 'UPDATED_BY', 'table': 'ASSETS', 'category': 'lifecycle'},
    # Certificate timestamps (now confirmed available)
    'certificate_updated_at': {'column': 'CERTIFICATE_UPDATED_AT', 'table': 'ASSETS', 'category': 'governance'},
    'certificate_updated_by': {'column': 'CERTIFICATE_UPDATED_BY', 'table': 'ASSETS', 'category': 'governance'},
    # Source timestamps
    'source_created_at': {'column': 'SOURCE_CREATED_AT', 'table': 'ASSETS', 'category': 'lifecycle'},
    'source_updated_at': {'column': 'SOURCE_UPDATED_AT', 'table': 'ASSETS', 'category': 'lifecycle'},
    # Relational details
    'column_count': {'column': 'TABLE_COLUMN_COUNT', 'table': 'RELATIONAL_ASSET_DETAILS', 'category': 'relational'},
    'row_count': {'column': 'TABLE_ROW_COUNT', 'table': 'RELATIONAL_ASSET_DETAILS', 'category': 'relational'},
    'size_bytes': {'column': 'TABLE_SIZE_BYTES', 'table': 'RELATIONAL_ASSET_DETAILS', 'category': 'relational'},
    'read_count': {'column': 'TABLE_TOTAL_READ_COUNT', 'table': 'RELATIONAL_ASSET_DETAILS', 'category': 'relational'},
}


@router.get("/schema", response_model=MdlhSchemaResponse)
@handle_mdlh_errors
async def get_mdlh_schema(
    table_filter: str | None = Query(None, description="Filter to specific table (e.g., 'ASSETS')"),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> MdlhSchemaResponse:
    """
    Discover available MDLH Gold Layer schema columns.

    Returns all columns from ATLAN_GOLD.PUBLIC tables/views with their data types.
    This is useful for:
    - Understanding what fields are available in MDLH
    - Validating expected vs actual schema
    - Building dynamic queries
    """
    results = service.execute_query(SQL_GET_SCHEMA_COLUMNS)

    columns = []
    by_table: dict[str, list[MdlhSchemaColumn]] = {}

    for row in results:
        table_name = row.get("TABLE_NAME", "")

        # Apply table filter if specified
        if table_filter and table_name.upper() != table_filter.upper():
            continue

        column = MdlhSchemaColumn(
            table_name=table_name,
            column_name=row.get("COLUMN_NAME", ""),
            data_type=row.get("DATA_TYPE", ""),
            is_nullable=row.get("IS_NULLABLE", "YES") == "YES",
            comment=row.get("COMMENT"),
        )
        columns.append(column)

        if table_name not in by_table:
            by_table[table_name] = []
        by_table[table_name].append(column)

    return MdlhSchemaResponse(
        columns=columns,
        by_table=by_table,
        total_columns=len(columns),
        total_tables=len(by_table),
    )


@router.get("/schema/reconcile", response_model=ReconciliationResponse)
@handle_mdlh_errors
async def reconcile_schema(
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> ReconciliationResponse:
    """
    Compare expected fields vs actual MDLH schema.

    Returns a reconciliation report showing:
    - Which expected fields are available in MDLH
    - Which fields are missing
    - Which fields have no MDLH mapping defined
    - Summary by category
    """
    # Fetch actual schema
    results = service.execute_query(SQL_GET_SCHEMA_COLUMNS)

    # Build lookup: (table_name, column_name) -> MdlhSchemaColumn
    schema_lookup: dict[tuple[str, str], MdlhSchemaColumn] = {}
    for row in results:
        table_name = row.get("TABLE_NAME", "")
        column_name = row.get("COLUMN_NAME", "")
        column = MdlhSchemaColumn(
            table_name=table_name,
            column_name=column_name,
            data_type=row.get("DATA_TYPE", ""),
            is_nullable=row.get("IS_NULLABLE", "YES") == "YES",
            comment=row.get("COMMENT"),
        )
        schema_lookup[(table_name.upper(), column_name.upper())] = column

    # Reconcile expected fields
    reconciliations = []
    summary_available = 0
    summary_missing = 0
    summary_no_mapping = 0
    by_category: dict[str, dict[str, int]] = {}
    by_table: dict[str, dict[str, int]] = {}

    for field_id, mapping in EXPECTED_MDLH_FIELDS.items():
        expected_table = mapping['table']
        expected_column = mapping['column']
        category = mapping['category']

        # Initialize category stats
        if category not in by_category:
            by_category[category] = {'expected': 0, 'available': 0, 'missing': 0}
        by_category[category]['expected'] += 1

        # Initialize table stats
        if expected_table not in by_table:
            by_table[expected_table] = {'expected': 0, 'available': 0, 'missing': 0}
        by_table[expected_table]['expected'] += 1

        # Check if column exists in schema
        key = (expected_table.upper(), expected_column.upper())
        actual_column = schema_lookup.get(key)

        if actual_column:
            status = 'available'
            summary_available += 1
            by_category[category]['available'] += 1
            by_table[expected_table]['available'] += 1
        else:
            status = 'missing'
            summary_missing += 1
            by_category[category]['missing'] += 1
            by_table[expected_table]['missing'] += 1

        reconciliations.append(FieldReconciliation(
            field_id=field_id,
            field_name=field_id.replace('_', ' ').title(),
            category=category,
            expected_mdlh_column=expected_column,
            expected_mdlh_table=expected_table,
            actual_mdlh_column=actual_column,
            status=status,
        ))

    summary = ReconciliationSummary(
        total_expected=len(EXPECTED_MDLH_FIELDS),
        available=summary_available,
        missing=summary_missing,
        no_mapping=summary_no_mapping,
        by_category=by_category,
        by_table=by_table,
    )

    return ReconciliationResponse(
        reconciliations=reconciliations,
        summary=summary,
    )


# ============================================
# Direct Snowflake Metadata Endpoints
# ============================================
# These endpoints query Snowflake directly (SHOW commands, INFORMATION_SCHEMA)
# for raw schema metadata. Useful for query building and data exploration.
# Uses the same session as MDLH endpoints for unified connection management.


@router.get("/snowflake/databases")
@handle_mdlh_errors
async def get_snowflake_databases_endpoint(
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get list of accessible Snowflake databases (direct query via SHOW DATABASES).
    Uses metadata cache for performance.
    """
    databases = service.get_snowflake_databases()
    return {
        "databases": databases,
        "count": len(databases),
        "source": "snowflake_direct",
    }


@router.get("/snowflake/schemas/{database}")
@handle_mdlh_errors
async def get_snowflake_schemas_endpoint(
    database: str,
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get list of schemas in a Snowflake database (direct query via SHOW SCHEMAS).
    Uses metadata cache for performance.
    """
    schemas = service.get_snowflake_schemas(database)
    return {
        "database": database,
        "schemas": schemas,
        "count": len(schemas),
        "source": "snowflake_direct",
    }


@router.get("/snowflake/tables/{database}/{schema}")
@handle_mdlh_errors
async def get_snowflake_tables_endpoint(
    database: str,
    schema: str,
    include_views: bool = Query(True),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get list of tables/views in a Snowflake schema (direct query via SHOW TABLES/VIEWS).
    Uses metadata cache for performance.
    """
    tables = service.get_snowflake_tables(database, schema, include_views=include_views)
    return {
        "database": database,
        "schema": schema,
        "tables": tables,
        "count": len(tables),
        "source": "snowflake_direct",
    }


@router.get("/snowflake/columns/{database}/{schema}/{table}")
@handle_mdlh_errors
async def get_snowflake_columns_endpoint(
    database: str,
    schema: str,
    table: str,
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get list of columns for a Snowflake table (via INFORMATION_SCHEMA.COLUMNS).
    Uses metadata cache for performance.
    """
    columns = service.get_snowflake_columns(database, schema, table)
    return {
        "database": database,
        "schema": schema,
        "table": table,
        "columns": columns,
        "count": len(columns),
        "source": "snowflake_direct",
    }


@router.get("/snowflake/preview/{database}/{schema}/{table}")
@handle_mdlh_errors
async def get_snowflake_table_preview_endpoint(
    database: str,
    schema: str,
    table: str,
    limit: int = Query(100, ge=1, le=1000),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get preview data from a Snowflake table (SELECT * LIMIT N).
    Returns column metadata and sample rows.
    """
    preview = service.get_snowflake_table_preview(database, schema, table, limit=limit)
    preview["source"] = "snowflake_direct"
    return preview


# ============================================
# Cache Management Endpoints
# ============================================

from ..services.cache import query_cache, metadata_cache as _metadata_cache


@router.get("/cache/stats")
async def get_cache_stats() -> dict[str, Any]:
    """
    Get statistics for query and metadata caches.
    Useful for monitoring and debugging cache performance.
    """
    return {
        "query_cache": query_cache.get_stats(),
        "metadata_cache": _metadata_cache.get_stats(),
    }


@router.post("/cache/invalidate")
async def invalidate_cache(
    cache_type: str = Query("all", description="Cache type: query, metadata, or all"),
) -> dict[str, Any]:
    """
    Invalidate caches to force fresh data retrieval.

    Args:
        cache_type: "query" for query cache, "metadata" for schema cache, "all" for both
    """
    if cache_type not in ("query", "metadata", "all"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid cache_type: {cache_type}. Use 'query', 'metadata', or 'all'."
        )

    result = {}
    if cache_type in ("query", "all"):
        count = query_cache.invalidate()
        result["query_entries_cleared"] = count

    if cache_type in ("metadata", "all"):
        _metadata_cache.invalidate_all()
        result["metadata_cleared"] = True

    result["cache_type"] = cache_type
    return result
