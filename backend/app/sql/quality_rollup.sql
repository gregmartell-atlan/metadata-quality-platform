-- =============================================================================
-- MDLH Quality Rollup Query
-- =============================================================================
-- Aggregates quality scores by a dimension (connector, database, schema, etc.)
-- Use {dimension} placeholder to specify the grouping column.
-- =============================================================================

SELECT
    {dimension} AS dimension_value,
    COUNT(*) AS total_assets,
    
    -- =========================================================================
    -- COVERAGE METRICS (percentage of assets with each attribute)
    -- =========================================================================
    AVG(CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' 
        THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_description,
    
    AVG(CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 
        THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_owner,
    
    AVG(CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 
        THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_tags,
    
    AVG(CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' 
        THEN 1.0 ELSE 0.0 END) * 100 AS pct_certified,
    
    AVG(CASE WHEN A.HAS_LINEAGE = TRUE 
        THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_lineage,
    
    AVG(CASE WHEN A.README_GUID IS NOT NULL 
        THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_readme,
    
    AVG(CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 
        THEN 1.0 ELSE 0.0 END) * 100 AS pct_with_terms,
    
    -- =========================================================================
    -- AVERAGE QUALITY SCORES
    -- =========================================================================
    
    -- Completeness
    AVG(
        (CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 ELSE 0 END +
         CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN R.TABLE_COLUMN_COUNT > 0 OR A.ASSET_TYPE NOT IN ('Table','View') THEN 1 ELSE 0 END
        ) / 6.0 * 100
    ) AS avg_completeness,
    
    -- Accuracy
    AVG(
        (CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[A-Za-z_][A-Za-z0-9_]*$') THEN 1 ELSE 0 END +
         CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1 ELSE 0 END +
         CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END +
         1
        ) / 5.0 * 100
    ) AS avg_accuracy,
    
    -- Timeliness
    AVG(
        CASE WHEN DATEDIFF('day', 
            TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, A.UPDATED_AT)/1000), 
            CURRENT_TIMESTAMP()) <= 90 
        THEN 100.0 ELSE 0.0 END
    ) AS avg_timeliness,
    
    -- Consistency
    AVG(
        (CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 3 THEN 1 ELSE 0 END +
         CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[a-z][a-z0-9_]*$') THEN 1 ELSE 0 END
        ) / 4.0 * 100
    ) AS avg_consistency,
    
    -- Usability
    AVG(
        (CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
         CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
         CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END +
         1
        ) / 4.0 * 100
    ) AS avg_usability,
    
    -- =========================================================================
    -- OVERALL SCORE (weighted average of all dimensions)
    -- =========================================================================
    (
        AVG((CASE WHEN A.DESCRIPTION IS NOT NULL AND TRIM(A.DESCRIPTION) != '' THEN 1 ELSE 0 END +
             CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN A.README_GUID IS NOT NULL THEN 1 ELSE 0 END +
             CASE WHEN A.TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(A.TERM_GUIDS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN R.TABLE_COLUMN_COUNT > 0 OR A.ASSET_TYPE NOT IN ('Table','View') THEN 1 ELSE 0 END
            ) / 6.0 * 100) * 0.25
        +
        AVG((CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[A-Za-z_][A-Za-z0-9_]*$') THEN 1 ELSE 0 END +
             CASE WHEN A.OWNER_USERS IS NOT NULL AND ARRAY_SIZE(A.OWNER_USERS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN UPPER(COALESCE(A.CERTIFICATE_STATUS, '')) = 'VERIFIED' THEN 1 ELSE 0 END +
             CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END +
             1
            ) / 5.0 * 100) * 0.20
        +
        AVG(CASE WHEN DATEDIFF('day', 
                TO_TIMESTAMP(COALESCE(A.SOURCE_UPDATED_AT, A.UPDATED_AT)/1000), 
                CURRENT_TIMESTAMP()) <= 90 
            THEN 100.0 ELSE 0.0 END) * 0.20
        +
        AVG((CASE WHEN A.TAGS IS NOT NULL AND ARRAY_SIZE(A.TAGS) > 0 THEN 1 ELSE 0 END +
             CASE WHEN A.CONNECTOR_QUALIFIED_NAME IS NOT NULL THEN 1 ELSE 0 END +
             CASE WHEN ARRAY_SIZE(SPLIT(A.ASSET_QUALIFIED_NAME, '/')) >= 3 THEN 1 ELSE 0 END +
             CASE WHEN REGEXP_LIKE(A.ASSET_NAME, '^[a-z][a-z0-9_]*$') THEN 1 ELSE 0 END
            ) / 4.0 * 100) * 0.15
        +
        AVG((CASE WHEN COALESCE(A.POPULARITY_SCORE, 0) > 0 THEN 1 ELSE 0 END +
             CASE WHEN COALESCE(R.TABLE_TOTAL_READ_COUNT, 0) > 0 THEN 1 ELSE 0 END +
             CASE WHEN A.HAS_LINEAGE = TRUE THEN 1 ELSE 0 END +
             1
            ) / 4.0 * 100) * 0.20
    ) AS avg_overall

FROM ATLAN_GOLD.PUBLIC.ASSETS A
LEFT JOIN ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS R ON A.GUID = R.GUID
WHERE A.STATUS = 'ACTIVE'
{asset_type_filter}
GROUP BY {dimension}
ORDER BY total_assets DESC;
