-- =============================================================================
-- MDLH Quality Scores Query
-- =============================================================================
-- Calculates five quality dimensions for each asset in the MDLH Gold Layer:
--   1. Completeness (6 checks): description, owner, tags, readme, terms, columns
--   2. Accuracy (5 checks): valid naming, owner, certified, hierarchy, not AI
--   3. Timeliness (1 check): updated within 90 days
--   4. Consistency (4 checks): tags, connector, hierarchy, snake_case naming
--   5. Usability (4 checks): popularity, usage, lineage, discoverable
-- =============================================================================

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
    -- COMPLETENESS SCORE (6 checks, each worth 16.67%)
    -- =========================================================================
    -- 1. Has description
    CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 ELSE 0 END AS has_description,
    -- 2. Has owner
    CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END AS has_owner,
    -- 3. Has tags
    CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END AS has_tags,
    -- 4. Has readme
    CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END AS has_readme,
    -- 5. Has terms
    CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END AS has_terms,
    -- 6. Has columns (for tables/views) or N/A for other types
    CASE WHEN R.TABLE_COLUMN_COUNT > 0 OR A.ASSET_TYPE NOT IN ('Table','View') THEN 1 ELSE 0 END AS has_columns,
    
    -- Completeness aggregate
    (CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 ELSE 0 END +
     CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN R.TABLE_COLUMN_COUNT > 0 OR A.ASSET_TYPE NOT IN ('Table','View') THEN 1 ELSE 0 END
    ) / 6.0 * 100 AS completeness_score,
    
    -- =========================================================================
    -- ACCURACY SCORE (5 checks, each worth 20%)
    -- =========================================================================
    -- 1. Valid naming convention (alphanumeric with underscores)
    CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[A-Za-z_][A-Za-z0-9_]*$') THEN 1 ELSE 0 END AS valid_naming,
    -- 2. Has owner (reused)
    -- 3. Is certified
    CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1 ELSE 0 END AS is_certified,
    -- 4. Has valid hierarchy (connector path exists)
    CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END AS has_hierarchy,
    -- 5. Not AI generated (default to true - not tracked in MDLH)
    1 AS not_ai_generated,
    
    -- Accuracy aggregate
    (CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[A-Za-z_][A-Za-z0-9_]*$') THEN 1 ELSE 0 END +
     CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1 ELSE 0 END +
     CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END +
     1  -- Not AI generated (default)
    ) / 5.0 * 100 AS accuracy_score,
    
    -- =========================================================================
    -- TIMELINESS SCORE (binary: 100 if recent, 0 if stale)
    -- =========================================================================
    -- Updated within 90 days (either source or metadata update)
    CASE WHEN DATEDIFF('day', 
        TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, A.UPDATED_AT)/1000), 
        CURRENT_TIMESTAMP()) <= 90 
    THEN 100 ELSE 0 END AS timeliness_score,
    
    -- Days since last update (for reference)
    DATEDIFF('day', 
        TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, A.UPDATED_AT)/1000), 
        CURRENT_TIMESTAMP()
    ) AS days_since_update,
    
    -- =========================================================================
    -- CONSISTENCY SCORE (4 checks, each worth 25%)
    -- =========================================================================
    -- 1. Has tags (reused)
    -- 2. Has connector path
    -- 3. Valid hierarchy depth (at least 3 levels: connection/database/schema)
    CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 3 THEN 1 ELSE 0 END AS valid_hierarchy_depth,
    -- 4. Snake case naming (lowercase with underscores)
    CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[a-z][a-z0-9_]*$') THEN 1 ELSE 0 END AS snake_case_naming,
    
    -- Consistency aggregate
    (CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
     CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 3 THEN 1 ELSE 0 END +
     CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[a-z][a-z0-9_]*$') THEN 1 ELSE 0 END
    ) / 4.0 * 100 AS consistency_score,
    
    -- =========================================================================
    -- USABILITY SCORE (4 checks, each worth 25%)
    -- =========================================================================
    -- 1. Has popularity score
    CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END AS has_popularity,
    -- 2. Has usage (read count from source)
    CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END AS has_usage,
    -- 3. Has lineage
    CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END AS lineage_exists,
    -- 4. Is discoverable (default to true - all assets in MDLH are discoverable)
    1 AS is_discoverable,
    
    -- Usability aggregate
    (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
     CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END +
     1  -- Discoverable (default)
    ) / 4.0 * 100 AS usability_score,
    
    -- =========================================================================
    -- OVERALL SCORE (weighted average)
    -- =========================================================================
    -- Weights: Completeness 25%, Accuracy 20%, Timeliness 20%, 
    --          Consistency 15%, Usability 20%
    (
        (CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 ELSE 0 END +
         CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN R.TABLE_COLUMN_COUNT > 0 OR A.ASSET_TYPE NOT IN ('Table','View') THEN 1 ELSE 0 END
        ) / 6.0 * 100 * 0.25  -- Completeness weight
        +
        (CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[A-Za-z_][A-Za-z0-9_]*$') THEN 1 ELSE 0 END +
         CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1 ELSE 0 END +
         CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END +
         1
        ) / 5.0 * 100 * 0.20  -- Accuracy weight
        +
        CASE WHEN DATEDIFF('day', 
            TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, A.UPDATED_AT)/1000), 
            CURRENT_TIMESTAMP()) <= 90 
        THEN 100 ELSE 0 END * 0.20  -- Timeliness weight
        +
        (CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 3 THEN 1 ELSE 0 END +
         CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[a-z][a-z0-9_]*$') THEN 1 ELSE 0 END
        ) / 4.0 * 100 * 0.15  -- Consistency weight
        +
        (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
         CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END +
         1
        ) / 4.0 * 100 * 0.20  -- Usability weight
    ) AS overall_score

FROM ATLAN_GOLD.PUBLIC.ASSETS A
LEFT JOIN ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS R ON A.GUID = R.GUID
WHERE A.STATUS = 'ACTIVE'
-- Optional filters (uncomment as needed):
-- AND A.ASSET_TYPE IN ('Table', 'View', 'MaterializedView')
-- AND A.CONNECTOR_NAME = 'snowflake'
ORDER BY A.POPULARITY_SCORE DESC NULLS LAST, A.UPDATED_AT DESC;
