-- =============================================================================
-- MDLH Asset Search Query
-- =============================================================================
-- Searches assets with optional filters for type, connector, and text search.
-- Results are ordered by popularity and recency.
-- =============================================================================

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
    A.SOURCE_UPDATED_AT,
    A.CREATED_AT,
    A.CREATED_BY,
    A.UPDATED_BY
FROM ATLAN_GOLD.PUBLIC.ASSETS A
WHERE A.STATUS = 'ACTIVE'
{type_filter}
{connector_filter}
{search_filter}
ORDER BY A.POPULARITY_SCORE DESC NULLS LAST, A.UPDATED_AT DESC
LIMIT {limit}
OFFSET {offset};

-- =============================================================================
-- Count query for pagination
-- =============================================================================
-- SELECT COUNT(*) as total_count
-- FROM ATLAN_GOLD.PUBLIC.ASSETS A
-- WHERE A.STATUS = 'ACTIVE'
-- {type_filter}
-- {connector_filter}
-- =============================================================================

-- =============================================================================
-- Example filters:
-- =============================================================================
-- type_filter:      AND A.ASSET_TYPE = 'Table'
-- connector_filter: AND A.CONNECTOR_NAME = 'snowflake'
-- search_filter:    AND (A.ASSET_NAME ILIKE '%search_term%' 
--                        OR A.DESCRIPTION ILIKE '%search_term%')
-- =============================================================================
