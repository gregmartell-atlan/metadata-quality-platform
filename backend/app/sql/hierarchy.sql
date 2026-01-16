-- =============================================================================
-- MDLH Hierarchy Queries
-- =============================================================================
-- Derives the asset hierarchy (connectors, databases, schemas, tables) from
-- the ASSET_QUALIFIED_NAME field in the Gold Layer.
-- =============================================================================

-- =============================================================================
-- GET CONNECTORS
-- =============================================================================
-- Returns distinct connectors with asset counts
-- Used by: GET /mdlh/hierarchy/connectors
-- =============================================================================

-- SQL_HIERARCHY_CONNECTORS
SELECT 
    CONNECTOR_NAME,
    COUNT(*) as asset_count
FROM ATLAN_GOLD.PUBLIC.ASSETS 
WHERE STATUS = 'ACTIVE' 
  AND CONNECTOR_NAME IS NOT NULL
GROUP BY CONNECTOR_NAME
ORDER BY asset_count DESC;


-- =============================================================================
-- GET DATABASES FOR A CONNECTOR
-- =============================================================================
-- Returns databases derived from the first segment of ASSET_QUALIFIED_NAME
-- Used by: GET /mdlh/hierarchy/databases?connector=X
-- Parameters: %(connector)s
-- =============================================================================

-- SQL_HIERARCHY_DATABASES
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
ORDER BY asset_count DESC;


-- =============================================================================
-- GET SCHEMAS FOR A DATABASE
-- =============================================================================
-- Returns schemas derived from the second segment of ASSET_QUALIFIED_NAME
-- Used by: GET /mdlh/hierarchy/schemas?connector=X&database=Y
-- Parameters: %(connector)s, %(database)s
-- =============================================================================

-- SQL_HIERARCHY_SCHEMAS
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
ORDER BY asset_count DESC;


-- =============================================================================
-- GET TABLES/VIEWS FOR A SCHEMA
-- =============================================================================
-- Returns tables and views within a specific schema
-- Used by: GET /mdlh/hierarchy/tables?connector=X&database=Y&schema=Z
-- Parameters: %(connector)s, %(database)s, %(schema)s
-- =============================================================================

-- SQL_HIERARCHY_TABLES
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
ORDER BY POPULARITY_SCORE DESC NULLS LAST, ASSET_NAME ASC;


-- =============================================================================
-- GET SINGLE ASSET DETAILS
-- =============================================================================
-- Returns full details for a single asset by GUID
-- Used by: GET /mdlh/asset/{guid}
-- Parameters: %(guid)s
-- =============================================================================

-- SQL_ASSET_DETAIL
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
    
    -- Relational details (if available)
    R.TABLE_COLUMN_COUNT,
    R.TABLE_ROW_COUNT,
    R.TABLE_SIZE_BYTES,
    R.TABLE_TOTAL_READ_COUNT,
    R.TABLE_TOTAL_QUERY_COUNT,
    R.DATABASE_NAME,
    R.SCHEMA_NAME
    
FROM ATLAN_GOLD.PUBLIC.ASSETS A
LEFT JOIN ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS R ON A.GUID = R.GUID
WHERE A.GUID = %(guid)s;


-- =============================================================================
-- SEARCH ASSETS WITH HIERARCHY CONTEXT
-- =============================================================================
-- Returns assets matching search criteria with hierarchy information
-- Used for loading assets within a context
-- Parameters: %(connector)s, %(database)s, %(schema)s, %(limit)s, %(offset)s
-- =============================================================================

-- SQL_HIERARCHY_ASSETS_IN_CONTEXT
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
    
    -- Derived hierarchy
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
OFFSET {offset};
