/**
 * MDLH SQL Queries Module
 *
 * Consolidated SQL queries for the Metadata Lakehouse (MDLH) Gold Layer.
 * All queries reference the ATLAN_GOLD.PUBLIC schema.
 *
 * Schema Reference:
 * - ATLAN_GOLD.PUBLIC.ASSETS: Main asset table with metadata
 * - ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS: Extended details for tables/views
 * - ATLAN_GOLD.PUBLIC.LINEAGE: Pre-computed lineage relationships
 */

// ============================================
// Schema Constants
// ============================================

export const MDLH_SCHEMA = 'ATLAN_GOLD.PUBLIC';
export const ASSETS_TABLE = `${MDLH_SCHEMA}.ASSETS`;
export const RELATIONAL_DETAILS_TABLE = `${MDLH_SCHEMA}.RELATIONAL_ASSET_DETAILS`;
export const LINEAGE_TABLE = `${MDLH_SCHEMA}.LINEAGE`;

// ============================================
// Connector Queries
// ============================================

/**
 * Get all connectors with asset counts
 * Used by: GET /mdlh/connectors, GET /mdlh/hierarchy/connectors
 */
export const GET_CONNECTORS = `
SELECT
    CONNECTOR_NAME,
    COUNT(*) as ASSET_COUNT
FROM ${ASSETS_TABLE}
WHERE STATUS = 'ACTIVE'
  AND CONNECTOR_NAME IS NOT NULL
GROUP BY CONNECTOR_NAME
ORDER BY ASSET_COUNT DESC
`;

// ============================================
// Database Queries
// ============================================

/**
 * Get databases for a specific connector
 * Databases are derived from the first segment of ASSET_QUALIFIED_NAME
 * Used by: GET /mdlh/hierarchy/databases
 * Parameters: connector
 */
export const GET_DATABASES = `
SELECT DISTINCT
    SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 1) as DATABASE_NAME,
    MIN(GUID) as SAMPLE_GUID,
    COUNT(*) as ASSET_COUNT
FROM ${ASSETS_TABLE}
WHERE STATUS = 'ACTIVE'
  AND CONNECTOR_NAME = :connector
  AND ASSET_QUALIFIED_NAME IS NOT NULL
  AND ASSET_TYPE IN ('Database', 'Table', 'View', 'MaterializedView', 'Schema')
GROUP BY DATABASE_NAME
HAVING DATABASE_NAME IS NOT NULL AND DATABASE_NAME != ''
ORDER BY ASSET_COUNT DESC
`;

/**
 * Get all databases across all connectors
 * Used by: GET /mdlh/databases
 */
export const GET_ALL_DATABASES = `
SELECT DISTINCT
    SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 1) as DATABASE_NAME,
    CONNECTOR_NAME,
    COUNT(*) as ASSET_COUNT
FROM ${ASSETS_TABLE}
WHERE STATUS = 'ACTIVE'
    AND ASSET_TYPE IN ('Database', 'Table', 'View', 'Schema')
    AND ASSET_QUALIFIED_NAME IS NOT NULL
GROUP BY SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 1), CONNECTOR_NAME
ORDER BY ASSET_COUNT DESC
`;

// ============================================
// Schema Queries
// ============================================

/**
 * Get schemas for a specific database within a connector
 * Schemas are derived from the second segment of ASSET_QUALIFIED_NAME
 * Used by: GET /mdlh/hierarchy/schemas
 * Parameters: connector, database
 */
export const GET_SCHEMAS = `
SELECT DISTINCT
    SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 2) as SCHEMA_NAME,
    MIN(GUID) as SAMPLE_GUID,
    COUNT(*) as ASSET_COUNT
FROM ${ASSETS_TABLE}
WHERE STATUS = 'ACTIVE'
  AND CONNECTOR_NAME = :connector
  AND SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 1) = :database
  AND ASSET_QUALIFIED_NAME IS NOT NULL
  AND ASSET_TYPE IN ('Schema', 'Table', 'View', 'MaterializedView')
GROUP BY SCHEMA_NAME
HAVING SCHEMA_NAME IS NOT NULL AND SCHEMA_NAME != ''
ORDER BY ASSET_COUNT DESC
`;

// ============================================
// Table Queries
// ============================================

/**
 * Get tables/views within a specific schema
 * Used by: GET /mdlh/hierarchy/tables
 * Parameters: connector, database, schema, limit
 */
export const GET_TABLES = `
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
FROM ${ASSETS_TABLE}
WHERE STATUS = 'ACTIVE'
  AND CONNECTOR_NAME = :connector
  AND SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 1) = :database
  AND SPLIT_PART(ASSET_QUALIFIED_NAME, '/', 2) = :schema
  AND ASSET_TYPE IN ('Table', 'View', 'MaterializedView')
ORDER BY POPULARITY_SCORE DESC NULLS LAST, ASSET_NAME ASC
LIMIT :limit
`;

// ============================================
// Asset Detail Queries
// ============================================

/**
 * Get full details for a single asset by GUID
 * Joins with RELATIONAL_ASSET_DETAILS for table/view specific metrics
 * Used by: GET /mdlh/asset/{guid}
 * Parameters: guid
 */
export const GET_ASSET_DETAILS = `
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
    SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 1) AS DATABASE_NAME,
    SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 2) AS SCHEMA_NAME
FROM ${ASSETS_TABLE} A
LEFT JOIN ${RELATIONAL_DETAILS_TABLE} R ON A.GUID = R.GUID
WHERE A.GUID = :guid
`;

// ============================================
// Search Asset Queries
// ============================================

/**
 * Search assets with optional filters
 * Used by: GET /mdlh/assets
 * Filter placeholders: {type_filter}, {connector_filter}, {search_filter}
 * Parameters: limit, offset
 */
export const SEARCH_ASSETS = `
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
    A.README_GUID,
    A.UPDATED_AT,
    A.SOURCE_UPDATED_AT
FROM ${ASSETS_TABLE} A
WHERE A.STATUS = 'ACTIVE'
{type_filter}
{connector_filter}
{search_filter}
ORDER BY A.POPULARITY_SCORE DESC NULLS LAST, A.UPDATED_AT DESC
LIMIT {limit}
OFFSET {offset}
`;

/**
 * Count assets matching search criteria (for pagination)
 * Filter placeholders: {type_filter}, {connector_filter}
 */
export const COUNT_ASSETS = `
SELECT COUNT(*) as TOTAL_COUNT
FROM ${ASSETS_TABLE} A
WHERE A.STATUS = 'ACTIVE'
{type_filter}
{connector_filter}
`;

/**
 * Search assets with hierarchy context (includes derived database/schema names)
 * Used by: GET /mdlh/hierarchy/assets
 * Filter placeholders: {connector_filter}, {database_filter}, {schema_filter}
 * Parameters: limit, offset
 */
export const SEARCH_ASSETS_WITH_HIERARCHY = `
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
    SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 1) as DATABASE_NAME,
    SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 2) as SCHEMA_NAME,
    SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 3) as TABLE_NAME
FROM ${ASSETS_TABLE} A
WHERE A.STATUS = 'ACTIVE'
  AND A.ASSET_TYPE IN ('Table', 'View', 'MaterializedView')
  {connector_filter}
  {database_filter}
  {schema_filter}
ORDER BY A.POPULARITY_SCORE DESC NULLS LAST, A.UPDATED_AT DESC
LIMIT {limit}
OFFSET {offset}
`;

// ============================================
// Lineage Queries
// ============================================

/**
 * Get lineage relationships for an asset
 * Used by: GET /mdlh/lineage/{guid}
 * Parameters: guid
 * Filter placeholders: {direction_filter}, {level_filter}
 */
export const GET_LINEAGE = `
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
FROM ${LINEAGE_TABLE}
WHERE START_GUID = :guid
{direction_filter}
{level_filter}
ORDER BY LEVEL ASC, DIRECTION ASC
`;

/**
 * Get lineage metrics with upstream/downstream breakdown
 * Used by: GET /mdlh/lineage-metrics
 * Filter placeholders: {type_filter}, {connector_filter}
 */
export const GET_LINEAGE_METRICS = `
WITH lineage_breakdown AS (
    SELECT
        L.START_GUID AS GUID,
        MAX(CASE WHEN L.DIRECTION = 'UPSTREAM' THEN 1 ELSE 0 END) AS HAS_UPSTREAM,
        MAX(CASE WHEN L.DIRECTION = 'DOWNSTREAM' THEN 1 ELSE 0 END) AS HAS_DOWNSTREAM,
        COUNT(DISTINCT CASE WHEN L.DIRECTION = 'UPSTREAM' THEN L.RELATED_GUID END) AS UPSTREAM_COUNT,
        COUNT(DISTINCT CASE WHEN L.DIRECTION = 'DOWNSTREAM' THEN L.RELATED_GUID END) AS DOWNSTREAM_COUNT
    FROM ${LINEAGE_TABLE} L
    GROUP BY L.START_GUID
)
SELECT
    A.GUID,
    A.ASSET_NAME,
    A.ASSET_TYPE,
    A.CONNECTOR_NAME,
    COALESCE(LB.HAS_UPSTREAM, 0) AS HAS_UPSTREAM,
    COALESCE(LB.HAS_DOWNSTREAM, 0) AS HAS_DOWNSTREAM,
    CASE WHEN COALESCE(LB.HAS_UPSTREAM, 0) = 1 OR COALESCE(LB.HAS_DOWNSTREAM, 0) = 1
         THEN 1 ELSE 0 END AS HAS_LINEAGE,
    CASE WHEN COALESCE(LB.HAS_UPSTREAM, 0) = 1 AND COALESCE(LB.HAS_DOWNSTREAM, 0) = 1
         THEN 1 ELSE 0 END AS FULL_LINEAGE,
    CASE WHEN COALESCE(LB.HAS_UPSTREAM, 0) = 0 AND COALESCE(LB.HAS_DOWNSTREAM, 0) = 0
         THEN 1 ELSE 0 END AS ORPHANED,
    COALESCE(LB.UPSTREAM_COUNT, 0) AS UPSTREAM_COUNT,
    COALESCE(LB.DOWNSTREAM_COUNT, 0) AS DOWNSTREAM_COUNT
FROM ${ASSETS_TABLE} A
LEFT JOIN lineage_breakdown LB ON A.GUID = LB.GUID
WHERE A.STATUS = 'ACTIVE'
{type_filter}
{connector_filter}
`;

/**
 * Get lineage rollup aggregated by dimension
 * Used by: GET /mdlh/lineage-rollup
 * Filter placeholders: {dimension}, {asset_type_filter}
 */
export const GET_LINEAGE_ROLLUP = `
WITH lineage_breakdown AS (
    SELECT
        L.START_GUID AS GUID,
        MAX(CASE WHEN L.DIRECTION = 'UPSTREAM' THEN 1 ELSE 0 END) AS HAS_UPSTREAM,
        MAX(CASE WHEN L.DIRECTION = 'DOWNSTREAM' THEN 1 ELSE 0 END) AS HAS_DOWNSTREAM
    FROM ${LINEAGE_TABLE} L
    GROUP BY L.START_GUID
)
SELECT
    {dimension} AS DIMENSION_VALUE,
    COUNT(*) AS TOTAL_ASSETS,
    AVG(COALESCE(LB.HAS_UPSTREAM, 0)) * 100 AS PCT_HAS_UPSTREAM,
    AVG(COALESCE(LB.HAS_DOWNSTREAM, 0)) * 100 AS PCT_HAS_DOWNSTREAM,
    AVG(CASE WHEN COALESCE(LB.HAS_UPSTREAM, 0) = 1 OR COALESCE(LB.HAS_DOWNSTREAM, 0) = 1
             THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_LINEAGE,
    AVG(CASE WHEN COALESCE(LB.HAS_UPSTREAM, 0) = 1 AND COALESCE(LB.HAS_DOWNSTREAM, 0) = 1
             THEN 1.0 ELSE 0.0 END) * 100 AS PCT_FULL_LINEAGE,
    AVG(CASE WHEN COALESCE(LB.HAS_UPSTREAM, 0) = 0 AND COALESCE(LB.HAS_DOWNSTREAM, 0) = 0
             THEN 1.0 ELSE 0.0 END) * 100 AS PCT_ORPHANED
FROM ${ASSETS_TABLE} A
LEFT JOIN lineage_breakdown LB ON A.GUID = LB.GUID
WHERE A.STATUS = 'ACTIVE'
{asset_type_filter}
GROUP BY {dimension}
ORDER BY TOTAL_ASSETS DESC
`;

// ============================================
// Quality Score Queries
// ============================================

/**
 * Quality score calculation for individual assets
 * Calculates: completeness, accuracy, timeliness, consistency, usability
 * Used by: GET /mdlh/quality-scores, POST /mdlh/quality-scores/batch
 * Filter placeholders: {type_filter}, {connector_filter}
 */
export const GET_QUALITY_SCORES = `
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

    -- COMPLETENESS SCORE (8 checks)
    (CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 ELSE 0 END +
     CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_STATUS != '' THEN 1 ELSE 0 END +
     CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END +
     0 +
     CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END
    ) / 8.0 * 100 AS COMPLETENESS_SCORE,

    -- ACCURACY SCORE (5 checks)
    -- Note: CERTIFICATE_UPDATED_AT is available in MDLH ASSETS table (DDL line 18)
    (CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[\\\\w\\\\-\\\\.]+$') THEN 1 ELSE 0 END +
     CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_STATUS != '' THEN 1 ELSE 0 END +
     CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
     1
    ) / 5.0 * 100 AS ACCURACY_SCORE,

    -- TIMELINESS SCORE (binary: 100 if within 90 days, else 0)
    -- Note: Using UPDATED_AT, SOURCE_UPDATED_AT, and CERTIFICATE_UPDATED_AT (all available in MDLH)
    CASE WHEN (
        DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
        DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
        DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.CERTIFICATE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90
    ) THEN 100 ELSE 0 END AS TIMELINESS_SCORE,

    -- CONSISTENCY SCORE (4 checks)
    (CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 2 THEN 1 ELSE 0 END +
     CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END
    ) / 4.0 * 100 AS CONSISTENCY_SCORE,

    -- USABILITY SCORE (3 checks)
    (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
     1
    ) / 3.0 * 100 AS USABILITY_SCORE

FROM ${ASSETS_TABLE} A
LEFT JOIN ${RELATIONAL_DETAILS_TABLE} R ON A.GUID = R.GUID
WHERE A.STATUS = 'ACTIVE'
`;

// ============================================
// Quality Rollup Queries
// ============================================

/**
 * Quality rollup aggregated by dimension
 * Used by: GET /mdlh/quality-rollup
 * Placeholder: {dimension}, {asset_type_filter}
 */
export const GET_QUALITY_ROLLUP = `
SELECT
    {dimension} AS DIMENSION_VALUE,
    COUNT(*) AS TOTAL_ASSETS,

    -- Coverage metrics
    AVG(CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_DESCRIPTION,
    AVG(CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_OWNER,
    AVG(CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_TAGS,
    AVG(CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1.0 ELSE 0.0 END) * 100 AS PCT_CERTIFIED,
    AVG(CASE WHEN A.HAS_LINEAGE = TRUE THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_LINEAGE,
    AVG(CASE WHEN A.README_GUID IS NOT NULL THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_README,
    AVG(CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_TERMS,

    -- COMPLETENESS (8 checks)
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
    ) AS AVG_COMPLETENESS,

    -- ACCURACY (5 checks)
    AVG(
        (CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[\\\\w\\\\-\\\\.]+$') THEN 1 ELSE 0 END +
         CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_STATUS != '' THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         1
        ) / 5.0 * 100
    ) AS AVG_ACCURACY,

    -- TIMELINESS (binary, includes CERTIFICATE_UPDATED_AT)
    AVG(
        CASE WHEN (
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.CERTIFICATE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90
        ) THEN 100.0 ELSE 0.0 END
    ) AS AVG_TIMELINESS,

    -- CONSISTENCY (4 checks)
    AVG(
        (CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 2 THEN 1 ELSE 0 END +
         CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END
        ) / 4.0 * 100
    ) AS AVG_CONSISTENCY,

    -- USABILITY (3 checks)
    AVG(
        (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
         CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
         1
        ) / 3.0 * 100
    ) AS AVG_USABILITY

FROM ${ASSETS_TABLE} A
LEFT JOIN ${RELATIONAL_DETAILS_TABLE} R ON A.GUID = R.GUID
WHERE A.STATUS = 'ACTIVE'
{asset_type_filter}
GROUP BY {dimension}
ORDER BY TOTAL_ASSETS DESC
`;

/**
 * Quality rollup aggregated by owner (uses LATERAL FLATTEN for array handling)
 * Used by: GET /mdlh/quality-rollup/by-owner
 * Placeholder: {asset_type_filter}
 */
export const GET_QUALITY_ROLLUP_BY_OWNER = `
SELECT
    COALESCE(owner.VALUE::STRING, 'Unowned') AS DIMENSION_VALUE,
    COUNT(DISTINCT A.GUID) AS TOTAL_ASSETS,

    -- Coverage metrics
    AVG(CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_DESCRIPTION,
    AVG(CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_TAGS,
    AVG(CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1.0 ELSE 0.0 END) * 100 AS PCT_CERTIFIED,
    AVG(CASE WHEN A.HAS_LINEAGE = TRUE THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_LINEAGE,
    AVG(CASE WHEN A.README_GUID IS NOT NULL THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_README,
    AVG(CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_TERMS,

    -- COMPLETENESS (8 checks)
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
    ) AS AVG_COMPLETENESS,

    -- ACCURACY (5 checks)
    AVG(
        (CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[\\\\w\\\\-\\\\.]+$') THEN 1 ELSE 0 END +
         CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL AND A.CERTIFICATE_STATUS != '' THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         1
        ) / 5.0 * 100
    ) AS AVG_ACCURACY,

    -- TIMELINESS (includes CERTIFICATE_UPDATED_AT)
    AVG(
        CASE WHEN (
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.CERTIFICATE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90
        ) THEN 100.0 ELSE 0.0 END
    ) AS AVG_TIMELINESS,

    -- CONSISTENCY (4 checks)
    AVG(
        (CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 2 THEN 1 ELSE 0 END +
         CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END
        ) / 4.0 * 100
    ) AS AVG_CONSISTENCY,

    -- USABILITY (3 checks)
    AVG(
        (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
         CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
         1
        ) / 3.0 * 100
    ) AS AVG_USABILITY

FROM ${ASSETS_TABLE} A
LEFT JOIN ${RELATIONAL_DETAILS_TABLE} R ON A.GUID = R.GUID,
LATERAL FLATTEN(input => COALESCE(A.OWNER_USERS, ARRAY_CONSTRUCT(NULL)), outer => true) AS owner
WHERE A.STATUS = 'ACTIVE'
{asset_type_filter}
GROUP BY COALESCE(owner.VALUE::STRING, 'Unowned')
ORDER BY TOTAL_ASSETS DESC
`;

// ============================================
// Owner Queries
// ============================================

/**
 * List all owners with asset counts
 * Used by: GET /mdlh/owners
 */
export const GET_OWNERS = `
SELECT DISTINCT
    owner.VALUE::STRING AS OWNER,
    COUNT(DISTINCT A.GUID) AS ASSET_COUNT
FROM ${ASSETS_TABLE} A,
LATERAL FLATTEN(input => A.OWNER_USERS, outer => false) AS owner
WHERE A.STATUS = 'ACTIVE'
  AND owner.VALUE IS NOT NULL
GROUP BY owner.VALUE::STRING
ORDER BY ASSET_COUNT DESC
LIMIT 500
`;

// ============================================
// Pivot Queries
// ============================================

/**
 * Get pivot data for analytics (count metric)
 * Placeholders: {row_col}, {col_col}, {metric_sql}, {type_filter}
 */
export const GET_PIVOT_DATA = `
SELECT
    {row_col} AS ROW_DIMENSION,
    {col_col} AS COL_DIMENSION,
    {metric_sql} AS METRIC_VALUE
FROM ${ASSETS_TABLE} A
LEFT JOIN ${RELATIONAL_DETAILS_TABLE} R ON A.GUID = R.GUID
WHERE A.STATUS = 'ACTIVE'
{type_filter}
GROUP BY {row_col}, {col_col}
ORDER BY ROW_DIMENSION, COL_DIMENSION
`;

// ============================================
// Snapshot / Trends Queries
// ============================================

/**
 * Get current snapshot for time series storage
 * Placeholder: {dimension}, {asset_type_filter}
 */
export const GET_SNAPSHOT = `
SELECT
    CURRENT_DATE() AS SNAPSHOT_DATE,
    CURRENT_TIMESTAMP() AS SNAPSHOT_TIMESTAMP,
    {dimension} AS DIMENSION_VALUE,
    COUNT(*) AS TOTAL_ASSETS,

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
    ) AS AVG_COMPLETENESS,

    AVG(
        (CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[\\\\w\\\\-\\\\.]+$') THEN 1 ELSE 0 END +
         CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.CERTIFICATE_STATUS IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         1
        ) / 5.0 * 100
    ) AS AVG_ACCURACY,

    AVG(
        CASE WHEN (
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90 OR
            DATEDIFF('day', TO_TIMESTAMP(COALESCE(A.CERTIFICATE_UPDATED_AT, 0)/1000), CURRENT_TIMESTAMP()) <= 90
        ) THEN 100.0 ELSE 0.0 END
    ) AS AVG_TIMELINESS,

    AVG(
        (CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 2 THEN 1 ELSE 0 END +
         CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END
        ) / 4.0 * 100
    ) AS AVG_CONSISTENCY,

    AVG(
        (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
         CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
         1
        ) / 3.0 * 100
    ) AS AVG_USABILITY,

    -- Coverage metrics
    AVG(CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_DESCRIPTION,
    AVG(CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_OWNER,
    AVG(CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_TAGS,
    AVG(CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1.0 ELSE 0.0 END) * 100 AS PCT_CERTIFIED,
    AVG(CASE WHEN A.HAS_LINEAGE = TRUE THEN 1.0 ELSE 0.0 END) * 100 AS PCT_WITH_LINEAGE

FROM ${ASSETS_TABLE} A
LEFT JOIN ${RELATIONAL_DETAILS_TABLE} R ON A.GUID = R.GUID
WHERE A.STATUS = 'ACTIVE'
{asset_type_filter}
GROUP BY {dimension}
`;

// ============================================
// Helper Functions
// ============================================

/**
 * Escape a string value for safe use in SQL queries.
 * Prevents SQL injection by escaping single quotes.
 */
export function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Validate that a value matches an allowed pattern (alphanumeric, underscore, hyphen, dot).
 * Used for identifiers like asset types, connector names, etc.
 */
export function isValidIdentifier(value: string): boolean {
  return /^[\w\-\.]+$/.test(value);
}

/**
 * Build type filter clause for asset type
 * Uses parameterized escaping to prevent SQL injection
 */
export function buildTypeFilter(assetType?: string): string {
  if (!assetType || assetType === 'all') return '';
  // Validate and escape to prevent SQL injection
  const escaped = escapeSqlString(assetType);
  return `AND A.ASSET_TYPE = '${escaped}'`;
}

/**
 * Build connector filter clause
 * Uses parameterized escaping to prevent SQL injection
 */
export function buildConnectorFilter(connector?: string): string {
  if (!connector) return '';
  // Escape to prevent SQL injection
  const escaped = escapeSqlString(connector);
  return `AND A.CONNECTOR_NAME = '${escaped}'`;
}

/**
 * Build search filter clause for text search
 */
export function buildSearchFilter(query?: string): string {
  if (!query) return '';
  // Escape single quotes to prevent SQL injection
  const escaped = escapeSqlString(query);
  return `AND (A.ASSET_NAME ILIKE '%${escaped}%' OR A.DESCRIPTION ILIKE '%${escaped}%')`;
}

/**
 * Build direction filter for lineage queries
 * Only allows predefined values to prevent SQL injection
 */
export function buildDirectionFilter(direction?: 'UPSTREAM' | 'DOWNSTREAM' | 'BOTH'): string {
  if (!direction || direction === 'BOTH') return '';
  // Whitelist approach - only allow specific values
  if (direction !== 'UPSTREAM' && direction !== 'DOWNSTREAM') return '';
  return `AND DIRECTION = '${direction}'`;
}

/**
 * Build level filter for lineage queries
 */
export function buildLevelFilter(maxLevel?: number): string {
  if (!maxLevel) return '';
  // Ensure maxLevel is a valid integer to prevent SQL injection
  const level = Math.floor(Number(maxLevel));
  if (isNaN(level) || level <= 0) return '';
  return `AND LEVEL <= ${level}`;
}

/**
 * Map dimension to SQL column expression
 * Uses whitelist approach to prevent SQL injection
 */
export function getDimensionColumn(dimension: string): string {
  const dimensionMap: Record<string, string> = {
    connector: 'A.CONNECTOR_NAME',
    database: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 1)",
    schema: "SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 2)",
    asset_type: 'A.ASSET_TYPE',
    certificate_status: "COALESCE(A.CERTIFICATE_STATUS, 'NONE')",
  };
  // Whitelist approach - only allow predefined dimensions
  return dimensionMap[dimension] || 'A.CONNECTOR_NAME';
}

/**
 * Build database filter clause
 * Uses parameterized escaping to prevent SQL injection
 */
export function buildDatabaseFilter(database?: string): string {
  if (!database) return '';
  // Escape to prevent SQL injection
  const escaped = escapeSqlString(database);
  return `AND SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 1) = '${escaped}'`;
}

/**
 * Build schema filter clause
 * Uses parameterized escaping to prevent SQL injection
 */
export function buildSchemaFilter(schema?: string): string {
  if (!schema) return '';
  // Escape to prevent SQL injection
  const escaped = escapeSqlString(schema);
  return `AND SPLIT_PART(A.ASSET_QUALIFIED_NAME, '/', 2) = '${escaped}'`;
}

// ============================================
// Query Builder Utilities
// ============================================

/**
 * Replace placeholders in a query template
 */
export function formatQuery(
  template: string,
  params: Record<string, string | number>
): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

/**
 * Build a complete search query with filters
 */
export function buildSearchQuery(options: {
  assetType?: string;
  connector?: string;
  query?: string;
  limit: number;
  offset: number;
}): string {
  return formatQuery(SEARCH_ASSETS, {
    type_filter: buildTypeFilter(options.assetType),
    connector_filter: buildConnectorFilter(options.connector),
    search_filter: buildSearchFilter(options.query),
    limit: options.limit,
    offset: options.offset,
  });
}

/**
 * Build a complete count query with filters
 */
export function buildCountQuery(options: {
  assetType?: string;
  connector?: string;
}): string {
  return formatQuery(COUNT_ASSETS, {
    type_filter: buildTypeFilter(options.assetType),
    connector_filter: buildConnectorFilter(options.connector),
  });
}

/**
 * Build a quality rollup query for a dimension
 */
export function buildQualityRollupQuery(options: {
  dimension: string;
  assetType?: string;
}): string {
  return formatQuery(GET_QUALITY_ROLLUP, {
    dimension: getDimensionColumn(options.dimension),
    asset_type_filter: buildTypeFilter(options.assetType),
  });
}

/**
 * Build a lineage query with filters
 */
export function buildLineageQuery(options: {
  direction?: 'UPSTREAM' | 'DOWNSTREAM' | 'BOTH';
  maxLevel?: number;
}): string {
  return formatQuery(GET_LINEAGE, {
    direction_filter: buildDirectionFilter(options.direction),
    level_filter: buildLevelFilter(options.maxLevel),
  });
}

/**
 * Build hierarchy assets query with context filters
 */
export function buildHierarchyAssetsQuery(options: {
  connector?: string;
  database?: string;
  schema?: string;
  limit: number;
  offset: number;
}): string {
  return formatQuery(SEARCH_ASSETS_WITH_HIERARCHY, {
    connector_filter: buildConnectorFilter(options.connector),
    database_filter: buildDatabaseFilter(options.database),
    schema_filter: buildSchemaFilter(options.schema),
    limit: options.limit,
    offset: options.offset,
  });
}
