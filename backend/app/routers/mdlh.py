"""
MDLH Query Router for Metadata Lakehouse Gold Layer.

Provides endpoints for:
- Asset search and retrieval
- Quality score calculation
- Quality rollups by dimension
- Lineage traversal
- Pivot data aggregation
"""

import logging
from enum import Enum
from typing import Any
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends, Query, Header, Request
from pydantic import BaseModel, Field

from ..services.session import session_manager, SnowflakeSession
from ..config import get_settings

logger = logging.getLogger(__name__)

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
    A.GUID,
    A.ASSET_NAME,
    A.ASSET_TYPE,
    A.CONNECTOR_NAME,
    A.ASSET_QUALIFIED_NAME,
    A.DESCRIPTION,
    A.CERTIFICATE_STATUS,
    A.HAS_LINEAGE,
    A.POPULARITY_SCORE,
    A.UPDATED_AT,
    A.SOURCE_UPDATED_AT,
    A.OWNER_USERS,
    A.TAGS,
    A.TERM_GUIDS,
    A.README_GUID,
    
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
     CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_UPDATED_AT IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
     1  -- Not AI generated (default - not tracked in MDLH)
    ) / 5.0 * 100 AS accuracy_score,
    
    -- =========================================================================
    -- TIMELINESS SCORE (binary: 100 if ANY timestamp within 90 days, else 0)
    -- Aligned with client-side scoreTimeliness which checks multiple clocks
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
    -- USABILITY SCORE (4 checks, aligned with client-side scoreUsability)
    -- Checks: popularity/viewScore, consumption (read count), usage (query), discoverable
    -- =========================================================================
    (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(R.TABLE_TOTAL_QUERY_COUNT, 0) > 0 THEN 1 ELSE 0 END +
     1  -- Discoverable (default - all MDLH assets are discoverable)
    ) / 4.0 * 100 AS usability_score

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
         CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_UPDATED_AT IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         1  -- Not AI generated (default)
        ) / 5.0 * 100
    ) AS avg_accuracy,
    
    -- Timeliness (binary: any timestamp within 90 days)
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
    
    -- Usability (4 checks: popularity, read count, query count, discoverable)
    AVG(
        (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
         CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
         CASE WHEN COALESCE(R.TABLE_TOTAL_QUERY_COUNT, 0) > 0 THEN 1 ELSE 0 END +
         1  -- Discoverable (default)
        ) / 4.0 * 100
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
    SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 1) as database_name,
    CONNECTOR_NAME,
    COUNT(*) as asset_count
FROM ATLAN_GOLD.PUBLIC.ASSETS
WHERE STATUS = 'ACTIVE' 
    AND ASSET_TYPE IN ('Database', 'Table', 'View', 'Schema')
    AND ASSET_QUALIFIED_NAME IS NOT NULL
GROUP BY SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 1), CONNECTOR_NAME
ORDER BY asset_count DESC
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
# Dependency
# ============================================


class MdlhSessionContext:
    """Context for MDLH queries - wraps a session with query helpers."""
    
    def __init__(self, session: SnowflakeSession, session_id: str):
        self.session = session
        self.session_id = session_id
    
    def execute_query(
        self,
        query: str,
        params: dict | None = None,
        session_id: str | None = None,  # ignored, uses self.session
    ) -> list[dict]:
        """Execute query and return results as list of dicts."""
        from datetime import datetime
        
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
        finally:
            cursor.close()
    
    def execute_query_single(
        self,
        query: str,
        params: dict | None = None,
        session_id: str | None = None,
    ) -> dict | None:
        """Execute query and return single result or None."""
        results = self.execute_query(query, params)
        return results[0] if results else None


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


@router.get("/assets")
async def search_assets(
    query: str | None = None,
    asset_type: AssetType = AssetType.ALL,
    connector: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Search assets in the MDLH Gold Layer.

    Supports filtering by type, connector, and text search.
    Results are ordered by popularity and recency.
    """
    # Build filters
    type_filter = ""
    if asset_type != AssetType.ALL:
        type_filter = f"AND A.ASSET_TYPE = '{asset_type.value}'"

    connector_filter = ""
    if connector:
        connector_filter = f"AND A.CONNECTOR_NAME = '{connector}'"

    search_filter = ""
    if query:
        # Simple LIKE search - could be enhanced with full-text search
        search_filter = f"AND (A.ASSET_NAME ILIKE '%{query}%' OR A.DESCRIPTION ILIKE '%{query}%')"

    # Execute search query
    sql = SQL_SEARCH_ASSETS.format(
        type_filter=type_filter,
        connector_filter=connector_filter,
        search_filter=search_filter,
        limit=limit,
        offset=offset,
    )

    results = service.execute_query(sql)

    # Get total count
    count_sql = SQL_ASSET_COUNT.format(
        type_filter=type_filter,
        connector_filter=connector_filter,
    )
    count_result = service.execute_query_single(count_sql)
    total_count = count_result.get("TOTAL_COUNT", 0) if count_result else 0

    return {
        "assets": results,
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
    }


@router.get("/quality-scores")
async def get_quality_scores(
    asset_type: AssetType = AssetType.ALL,
    connector: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get quality scores for assets.

    Returns completeness, accuracy, timeliness, consistency, and usability
    scores for each asset, computed using MDLH data.
    """
    # Build filters
    type_filter = ""
    if asset_type != AssetType.ALL:
        type_filter = f"AND A.ASSET_TYPE = '{asset_type.value}'"

    connector_filter = ""
    if connector:
        connector_filter = f"AND A.CONNECTOR_NAME = '{connector}'"

    sql = f"""
    {SQL_QUALITY_SCORES}
    {type_filter}
    {connector_filter}
    ORDER BY A.POPULARITY_SCORE DESC NULLS LAST
    LIMIT {limit}
    OFFSET {offset}
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
        "limit": limit,
        "offset": offset,
    }


class BatchScoreRequest(BaseModel):
    """Request body for batch quality score fetching."""
    guids: list[str] = Field(..., max_length=1000, description="List of asset GUIDs to fetch scores for")


@router.post("/quality-scores/batch")
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


@router.get("/quality-rollup")
async def get_quality_rollup(
    dimension: PivotDimension = PivotDimension.CONNECTOR,
    asset_type: AssetType = AssetType.ALL,
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get aggregated quality scores by dimension.

    Computes average scores grouped by the specified dimension
    (connector, database, schema, asset_type, or certificate_status).
    """
    # Map dimension to SQL column
    dimension_map = {
        PivotDimension.CONNECTOR: "A.CONNECTOR_NAME",
        PivotDimension.DATABASE: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 1)",
        PivotDimension.SCHEMA: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 2)",
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


@router.get("/connectors")
async def get_connectors(
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get list of available connectors with asset counts.
    """
    results = service.execute_query(SQL_CONNECTORS)
    return {"connectors": results}


@router.get("/databases")
async def get_databases(
    connector: str | None = None,
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get list of databases with asset counts.
    """
    sql = SQL_DATABASES
    if connector:
        sql = sql.replace(
            "ORDER BY asset_count DESC",
            f"HAVING CONNECTOR_NAME = '{connector}' ORDER BY asset_count DESC"
        )

    results = service.execute_query(sql)
    return {"databases": results}


@router.get("/pivot")
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
    dimension_map = {
        PivotDimension.CONNECTOR: "A.CONNECTOR_NAME",
        PivotDimension.DATABASE: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 1)",
        PivotDimension.SCHEMA: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 2)",
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
    owner_groups: list[str] | None = None
    tags: list[str] | None = None
    term_guids: list[str] | None = None
    readme_guid: str | None = None
    updated_at: int | None = None
    source_updated_at: int | None = None
    created_at: int | None = None
    created_by: str | None = None
    updated_by: str | None = None
    status: str | None = None
    # Relational details
    column_count: int | None = None
    row_count: int | None = None
    size_bytes: int | None = None
    read_count: int | None = None
    query_count: int | None = None
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
    SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 1) as database_name,
    MIN(GUID) as sample_guid,
    COUNT(*) as asset_count
FROM ATLAN_GOLD.PUBLIC.ASSETS
WHERE STATUS = 'ACTIVE' 
  AND CONNECTOR_NAME = %(connector)s
  AND ASSET_QUALIFIED_NAME IS NOT NULL
  AND ASSET_TYPE IN ('Database', 'Table', 'View', 'MaterializedView', 'Schema')
GROUP BY database_name
HAVING database_name IS NOT NULL AND database_name != ''
ORDER BY asset_count DESC
"""


SQL_HIERARCHY_SCHEMAS = """
SELECT DISTINCT
    SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 2) as schema_name,
    MIN(GUID) as sample_guid,
    COUNT(*) as asset_count
FROM ATLAN_GOLD.PUBLIC.ASSETS
WHERE STATUS = 'ACTIVE'
  AND CONNECTOR_NAME = %(connector)s
  AND SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 1) = %(database)s
  AND ASSET_QUALIFIED_NAME IS NOT NULL
  AND ASSET_TYPE IN ('Schema', 'Table', 'View', 'MaterializedView')
GROUP BY schema_name
HAVING schema_name IS NOT NULL AND schema_name != ''
ORDER BY asset_count DESC
"""


SQL_HIERARCHY_TABLES = """
SELECT 
    GUID,
    ASSET_NAME,
    ASSET_TYPE,
    ASSET_QUALIFIED_NAME,
    DESCRIPTION,
    CERTIFICATE_STATUS,
    HAS_LINEAGE,
    POPULARITY_SCORE,
    OWNER_USERS,
    TAGS,
    UPDATED_AT
FROM ATLAN_GOLD.PUBLIC.ASSETS
WHERE STATUS = 'ACTIVE'
  AND CONNECTOR_NAME = %(connector)s
  AND SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 1) = %(database)s
  AND SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 2) = %(schema)s
  AND ASSET_TYPE IN ('Table', 'View', 'MaterializedView')
ORDER BY POPULARITY_SCORE DESC NULLS LAST, ASSET_NAME ASC
LIMIT %(limit)s
"""


SQL_ASSET_DETAIL = """
SELECT 
    A.GUID,
    A.ASSET_NAME,
    A.ASSET_TYPE,
    A.ASSET_QUALIFIED_NAME,
    A.CONNECTOR_NAME,
    A.CONNECTOR_QUALIFIED_NAME,
    A.DESCRIPTION,
    A.CERTIFICATE_STATUS,
    A.HAS_LINEAGE,
    A.POPULARITY_SCORE,
    A.OWNER_USERS,
    A.OWNER_GROUPS,
    A.TAGS,
    A.TERM_GUIDS,
    A.README_GUID,
    A.UPDATED_AT,
    A.SOURCE_UPDATED_AT,
    A.CREATED_AT,
    A.CREATED_BY,
    A.UPDATED_BY,
    A.STATUS,
    R.TABLE_COLUMN_COUNT,
    R.TABLE_ROW_COUNT,
    R.TABLE_SIZE_BYTES,
    R.TABLE_TOTAL_READ_COUNT,
    R.TABLE_TOTAL_QUERY_COUNT,
    R.DATABASE_NAME,
    R.SCHEMA_NAME
FROM ATLAN_GOLD.PUBLIC.ASSETS A
LEFT JOIN ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS R ON A.GUID = R.GUID
WHERE A.GUID = %(guid)s
"""


SQL_HIERARCHY_ASSETS_IN_CONTEXT = """
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
    SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 1) as database_name,
    SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 2) as schema_name,
    SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 3) as table_name
FROM ATLAN_GOLD.PUBLIC.ASSETS A
WHERE A.STATUS = 'ACTIVE'
  AND A.ASSET_TYPE IN ('Table', 'View', 'MaterializedView')
  {connector_filter}
  {database_filter}
  {schema_filter}
ORDER BY A.POPULARITY_SCORE DESC NULLS LAST, A.UPDATED_AT DESC
LIMIT {limit}
OFFSET {offset}
"""


@router.get("/hierarchy/connectors")
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


@router.get("/hierarchy/tables")
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
            owner_users=row.get("OWNER_USERS"),
            tags=row.get("TAGS"),
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
        owner_groups=result.get("OWNER_GROUPS"),
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
        query_count=result.get("TABLE_TOTAL_QUERY_COUNT"),
        database_name=result.get("DATABASE_NAME"),
        schema_name=result.get("SCHEMA_NAME"),
    )

    return {"asset": asset.model_dump()}


@router.get("/hierarchy/assets")
async def get_hierarchy_assets(
    connector: str | None = None,
    database: str | None = None,
    schema: str | None = None,
    limit: int = Query(1000, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    service: MdlhSessionContext = Depends(require_mdlh_connection),
) -> dict[str, Any]:
    """
    Get assets within a hierarchy context (connection, database, or schema).
    Used for loading assets for quality scoring.
    """
    # Build filters
    connector_filter = ""
    database_filter = ""
    schema_filter = ""

    if connector:
        connector_filter = f"AND A.CONNECTOR_NAME = '{connector}'"
    if database:
        database_filter = f"AND SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 1) = '{database}'"
    if schema:
        schema_filter = f"AND SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 2) = '{schema}'"

    sql = SQL_HIERARCHY_ASSETS_IN_CONTEXT.format(
        connector_filter=connector_filter,
        database_filter=database_filter,
        schema_filter=schema_filter,
        limit=limit,
        offset=offset,
    )

    results = service.execute_query(sql)

    # Also get total count for pagination
    count_sql = f"""
    SELECT COUNT(*) as total_count
    FROM ATLAN_GOLD.PUBLIC.ASSETS A
    WHERE A.STATUS = 'ACTIVE'
      AND A.ASSET_TYPE IN ('Table', 'View', 'MaterializedView')
      {connector_filter}
      {database_filter}
      {schema_filter}
    """
    count_result = service.execute_query_single(count_sql)
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
