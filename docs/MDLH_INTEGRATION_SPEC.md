# Metadata Lakehouse Integration Spec

## 1. Scope and goals
Define a unified metadata quality and lineage metrics spec that:
- Works on MDLH (Snowflake over Iceberg/Polaris).
- Works via the Atlan API/SDK.
- Provides plug-and-play templates:
  - Snowflake MDLH connection
  - Per-asset metrics view(s)
  - Rollups by connection, domain, database, schema, table
  - API/SDK functions with matching semantics

This is a specification document. Implementations map the canonical model to:
- MDLH (Snowflake): ATLAN_GOLD.PUBLIC.ASSETS, CUSTOM_METADATA, FULL_LINEAGE,
  RELATIONAL_ASSET_DETAILS, etc.
- API/SDK: Asset / Table models + get_custom_metadata() and lineage/DQ APIs.

---

## 2. Canonical data model

### 2.1 Canonical asset fields
Define everything in terms of a logical Asset.

```text
Asset {
  guid: string
  qualifiedName: string
  typeName: string

  description: string | null
  ownerUsers: string[]
  ownerGroups: string[]
  tags: string[]
  certificateStatus: string | null   -- Verified/Draft/Deprecated/etc

  updatedAtMillis: long              -- metadata last updated

  domainKey: string | null           -- business domain identifier
  connectionQualifiedName: string

  databaseKey: string | null         -- database identifier
  schemaKey: string | null           -- schema identifier
  tableKey: string | null            -- table identifier (for table assets)

  hasUpstream: bool                  -- lineage
  hasDownstream: bool

  customMetadata: Map<cmName, Map<attrName, value>>
  dqScores: {
    completeness: float (0-1)
    accuracy: float (0-1)
    timeliness: float (0-1)
    consistency: float (0-1)
    usability: float (0-1)
  }
}
```

---

## 3. Metric definitions (backend-agnostic)
All formulas are in terms of the canonical Asset.

### 3.1 Coverage and counts
Per asset:

```text
hasDescription  = I(description not null/blank)
hasOwner        = I(len(ownerUsers + ownerGroups) > 0)
isCertified     = I(lower(certificateStatus) = 'verified')
hasTags         = I(len(tags) > 0)
```

Per slice (e.g., by connection / domain / db / schema / table):

```text
Assets             = count(Asset)
PctWithDescription = avg(hasDescription)
PctWithOwner       = avg(hasOwner)
PctCertified       = avg(isCertified)
PctWithTags        = avg(hasTags)
```

### 3.2 Lineage metrics
Per asset:

```text
hasUpstream  = I(asset has any upstream in lineage)
hasDownstream= I(asset has any downstream in lineage)
hasLineage   = I(hasUpstream or hasDownstream)
fullLineage  = I(hasUpstream and hasDownstream)
orphaned     = I(not hasUpstream and not hasDownstream)
```

Per slice:

```text
PctHasUpstream   = avg(hasUpstream)
PctHasDownstream = avg(hasDownstream)
PctWithLineage   = avg(hasLineage)
PctFullLineage   = avg(fullLineage)
PctOrphaned      = avg(orphaned)
```

### 3.3 Quality scores
Weights (example):

```text
w_desc, w_tags, w_owner, w_cert, w_cm   -- completeness components
w_comp, w_acc, w_time, w_cons           -- to combine dimensions
```

Per asset:

```text
presentDesc  = hasDescription
presentTags  = hasTags
presentOwner = hasOwner
presentCert  = isCertified
presentCM    = I("required" CM attributes present)

CompletenessScore(asset) =
  (w_desc * presentDesc +
   w_tags * presentTags +
   w_owner* presentOwner +
   w_cert * presentCert +
   w_cm   * presentCM) / (w_desc + w_tags + w_owner + w_cert + w_cm)

AccuracyScore(asset)   = dqScores.accuracy
TimelinessScore(asset) = dqScores.timeliness
ConsistencyScore(asset)= dqScores.consistency
UsabilityScore(asset)  = dqScores.usability
```

Per slice:

```text
AvgCompleteness = avg(CompletenessScore)
AvgAccuracy     = avg(AccuracyScore)
AvgTimeliness   = avg(TimelinessScore)
AvgConsistency  = avg(ConsistencyScore)
AvgUsability    = avg(UsabilityScore)

OverallScore =
  w_comp * AvgCompleteness +
  w_acc  * AvgAccuracy +
  w_time * AvgTimeliness +
  w_cons * AvgConsistency
```

Weights are configurable (for example in weights.yaml).

---

## 4. Snowflake MDLH connection (Polaris / Iceberg REST)

### 4.1 Catalog integration

```sql
CREATE OR REPLACE CATALOG INTEGRATION atlan_catalog_int
  CATALOG_SOURCE     = POLARIS
  TABLE_FORMAT       = ICEBERG
  CATALOG_NAMESPACE  = 'entity_metadata'
  REST_CONFIG = (
    CATALOG_URI             = '<catalog_uri>'        -- from Atlan
    WAREHOUSE               = 'context_store'
    ACCESS_DELEGATION_MODE  = VENDED_CREDENTIALS
  )
  REST_AUTHENTICATION = (
    TYPE                  = OAUTH
    OAUTH_CLIENT_ID       = '<client_id>'
    OAUTH_CLIENT_SECRET   = '<client_secret>'
    OAUTH_ALLOWED_SCOPES  = ('PRINCIPAL_ROLE:lake_readers')
  )
  ENABLED = TRUE;
```

### 4.2 Linked database

```sql
CREATE DATABASE atlan_mdlh
  LINKED_CATALOG = (
    CATALOG               = 'atlan_catalog_int',
    SYNC_INTERVAL_SECONDS = 60
  );
```

### 4.3 Verification

```sql
USE DATABASE atlan_mdlh;
USE SCHEMA "entity_metadata";
SHOW TABLES;

SELECT * FROM "entity_metadata"."Table" LIMIT 10;

SELECT SYSTEM$CATALOG_LINK_STATUS('atlan_mdlh');
```

---

## 5. MDLH implementation (Snowflake / ATLAN_GOLD)

### 5.1 Per-asset metrics view: METRICS_PER_ASSET
Define a unified view in ATLAN_GOLD.PUBLIC that materializes the canonical flags and scores.

```sql
CREATE OR REPLACE VIEW ATLAN_GOLD.PUBLIC.METRICS_PER_ASSET AS
WITH lineage_flags AS (
  SELECT
    a.guid,
    CASE WHEN u.guid IS NOT NULL THEN 1 ELSE 0 END AS has_upstream,
    CASE WHEN d.guid IS NOT NULL THEN 1 ELSE 0 END AS has_downstream
  FROM ATLAN_GOLD.PUBLIC.ASSETS a
  LEFT JOIN (SELECT DISTINCT downstream_guid AS guid
             FROM ATLAN_GOLD.PUBLIC.FULL_LINEAGE) u ON a.guid = u.guid
  LEFT JOIN (SELECT DISTINCT upstream_guid AS guid
             FROM ATLAN_GOLD.PUBLIC.FULL_LINEAGE) d ON a.guid = d.guid
),
completeness_scores AS (
  SELECT
    a.guid,
    -- plug in completeness formula from section 3.3
    <computed_value> AS completeness_score_asset
  FROM ATLAN_GOLD.PUBLIC.ASSETS a
)
SELECT
  a.guid,
  a.qualified_name,
  a.asset_type,
  a.connection_qualified_name,

  -- database/schema/table/domain keys (join from RELATIONAL_ASSET_DETAILS / domain tables)
  r.database_name  AS database_key,
  r.schema_name    AS schema_key,
  r.table_name     AS table_key,
  r.domain_key     AS domain_key,

  -- coverage flags
  CASE WHEN a.description IS NOT NULL AND a.description <> '' THEN 1 ELSE 0 END AS has_description,
  CASE WHEN (a.owner_users IS NOT NULL AND ARRAY_SIZE(a.owner_users) > 0)
        OR (a.owner_groups IS NOT NULL AND ARRAY_SIZE(a.owner_groups) > 0)
       THEN 1 ELSE 0 END AS has_owner,
  CASE WHEN LOWER(a.certificate_status) = 'verified' THEN 1 ELSE 0 END AS is_certified,
  CASE WHEN a.tags IS NOT NULL AND ARRAY_SIZE(a.tags) > 0 THEN 1 ELSE 0 END AS has_tags,

  TO_TIMESTAMP(a.updated_at_ms/1000) AS metadata_updated_at,
  CASE WHEN TO_TIMESTAMP(a.updated_at_ms/1000)
            >= DATEADD('day', -30, CURRENT_TIMESTAMP())
       THEN 1 ELSE 0 END AS timely_flag,

  lf.has_upstream,
  lf.has_downstream,
  CASE WHEN lf.has_upstream = 1 OR lf.has_downstream = 1 THEN 1 ELSE 0 END AS has_lineage,
  CASE WHEN lf.has_upstream = 1 AND lf.has_downstream = 1 THEN 1 ELSE 0 END AS full_lineage,
  CASE WHEN lf.has_upstream = 0 AND lf.has_downstream = 0 THEN 1 ELSE 0 END AS orphaned,

  cs.completeness_score_asset AS completeness_score,
  0.0::FLOAT AS accuracy_score,
  0.0::FLOAT AS timeliness_score,
  0.0::FLOAT AS consistency_score,
  0.0::FLOAT AS usability_score

FROM ATLAN_GOLD.PUBLIC.ASSETS a
LEFT JOIN lineage_flags lf ON a.guid = lf.guid
LEFT JOIN completeness_scores cs ON a.guid = cs.guid
LEFT JOIN ATLAN_GOLD.PUBLIC.RELATIONAL_ASSET_DETAILS r ON a.guid = r.guid;
```

The exact joins/columns for database_key, schema_key, table_key, domain_key depend on the finalized GOLD schema; populate these from GOLD.

### 5.2 Slice rollups (all slices)
Generic slice template:

```sql
SELECT
  <slice_key> AS slice,
  COUNT(*)             AS total_assets,
  AVG(has_description) AS pct_with_description,
  AVG(has_owner)       AS pct_with_owner,
  AVG(is_certified)    AS pct_certified,
  AVG(has_lineage)     AS pct_with_lineage,

  AVG(has_upstream)    AS pct_has_upstream,
  AVG(has_downstream)  AS pct_has_downstream,
  AVG(full_lineage)    AS pct_full_lineage,
  AVG(orphaned)        AS pct_orphaned,

  AVG(completeness_score) AS avg_completeness,
  AVG(accuracy_score)     AS avg_accuracy,
  AVG(timeliness_score)   AS avg_timeliness,
  AVG(consistency_score)  AS avg_consistency,
  AVG(usability_score)    AS avg_usability,

  (0.4 * AVG(completeness_score)
   + 0.2 * AVG(accuracy_score)
   + 0.2 * AVG(timeliness_score)
   + 0.2 * AVG(consistency_score)) AS overall_score
FROM ATLAN_GOLD.PUBLIC.METRICS_PER_ASSET
WHERE asset_type IN ('Table','View','DataProduct')
GROUP BY <slice_key>
ORDER BY <slice_key>;
```

Concrete slices:
- By connection: <slice_key> = connection_qualified_name
- By domain: <slice_key> = domain_key
- By database: <slice_key> = database_key
- By schema: <slice_key> = schema_key
- By table: <slice_key> = table_key (per-table health row)

---

## 6. API / SDK backend
Mirror the same spec via the Atlan SDK.

### 6.1 Fetch assets
Use FluentSearch with CompoundQuery.active_assets() + asset_type filter.
Include fields: description, owners, tags, certificate, connection, updated_at,
plus any CM fields that hold DQ scores.

### 6.2 Per-asset evaluation
Implement hasDescription, hasOwner, isCertified, hasTags, completeness formula,
and optionally pull DQ scores from custom metadata.

```python
def compute_asset_metrics(asset: Asset, cm: dict | None) -> AssetMetrics:
    # returns flags + scores using the canonical spec
    ...
```

### 6.3 Slice aggregation
Use the same aggregation logic as in the SQL rollups.

```python
def aggregate_by_slice(assets: Iterable[AssetMetrics], key_fn) -> Dict[str, SliceMetrics]:
    # group by key_fn(asset) and compute counts, averages
    ...
```

Slices map to:
- key_fn = lambda a: a.connection_qualified_name
- key_fn = lambda a: a.domain_key
- key_fn = lambda a: a.database_key
- key_fn = lambda a: a.schema_key
- key_fn = lambda a: a.table_key

---

## 7. Config and extensibility
- Weights config: central file (for example YAML) with:
  - completeness weights (description, tags, owner, cert, CM)
  - overall score weights (completeness, accuracy, timeliness, consistency)
- Timeliness horizon: global or per-asset-type (30 days default).
- Dimension extensions: add new dimensions (e.g., Availability) as:
  - Per-asset 0-1 scores
  - Slice-level averages and combination into OverallScore.
