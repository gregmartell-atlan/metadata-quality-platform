-- =============================================================================
-- MDLH Lineage Query
-- =============================================================================
-- Retrieves upstream and/or downstream lineage for a given asset.
-- Uses the pre-computed LINEAGE view which handles recursive traversal.
-- =============================================================================

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
ORDER BY LEVEL ASC, DIRECTION ASC;

-- =============================================================================
-- Example usage:
-- =============================================================================
-- Full lineage (both directions, up to 5 hops):
--   direction_filter = ""
--   level_filter = "AND LEVEL <= 5"
--
-- Upstream only:
--   direction_filter = "AND DIRECTION = 'UPSTREAM'"
--
-- Downstream only:
--   direction_filter = "AND DIRECTION = 'DOWNSTREAM'"
-- =============================================================================
