# Repository Reconciliation Guide

## Overview

This document outlines the reconciliation strategy for unifying three related repositories:

1. **metadata-quality-platform** - Main quality scoring and visualization app
2. **atlan-metadata-evaluation** - Assessment and enrichment planning tool
3. *(Third repo - TBD)*

---

## Critical Differences

### 1. Table/View Names

| Repository | Table Name | Schema |
|------------|------------|--------|
| metadata-quality-platform | `ATLAN_GOLD.PUBLIC.ASSETS` | Analytics Gold Layer |
| atlan-metadata-evaluation | `ATLAN_ENTITY_LATEST` | MDLH Raw Layer |

**Resolution:** Create a configurable table reference that can be switched:

```typescript
// Proposed shared config
const MDLH_CONFIG = {
  table: process.env.MDLH_TABLE || 'ATLAN_GOLD.PUBLIC.ASSETS',
  // Alternatively: 'ATLAN_ENTITY_LATEST'
};
```

### 2. Scoring Weights

| Field | metadata-quality-platform | atlan-metadata-evaluation |
|-------|--------------------------|--------------------------|
| Description | 25 pts | 20 pts |
| Owner | 20 pts | 30 pts |
| Certificate | 15 pts | 25 pts |
| Tags | 15 pts | 25 pts |
| Glossary Terms | 10 pts | 15 pts |
| Lineage | 10 pts | 10 pts |
| README | 5 pts | 10 pts |
| **Total** | 100 pts | 135 pts |

**Resolution:** Normalize to shared weights in `config/scoring-weights.yaml`:

```yaml
completeness:
  checks:
    - id: hasOwner
      weight: 25
    - id: hasCertification
      weight: 20
    - id: hasDescription
      weight: 20
    - id: hasTags
      weight: 15
    - id: hasGlossaryTerms
      weight: 10
    - id: hasLineage
      weight: 5
    - id: hasReadme
      weight: 5
```

### 3. Field Name Mappings

| Canonical Name | ATLAN_GOLD | ATLAN_ENTITY_LATEST |
|----------------|------------|---------------------|
| typeName | ASSET_TYPE | __typeName |
| qualifiedName | ASSET_QUALIFIED_NAME | qualifiedName |
| state | STATUS | __state |
| ownerUsers | OWNER_USERS | ownerUsers |
| tags | TAGS | atlanTags |
| hasLineage | HAS_LINEAGE | __hasLineage |
| updateTime | UPDATED_AT | __modificationTimestamp |

**Resolution:** Create a field mapping layer:

```typescript
// src/services/mdlh/fieldMappings.ts
export const FIELD_MAPPINGS = {
  'ATLAN_GOLD.PUBLIC.ASSETS': {
    typeName: 'ASSET_TYPE',
    qualifiedName: 'ASSET_QUALIFIED_NAME',
    state: 'STATUS',
    ownerUsers: 'OWNER_USERS',
    tags: 'TAGS',
    hasLineage: 'HAS_LINEAGE',
    updateTime: 'UPDATED_AT',
  },
  'ATLAN_ENTITY_LATEST': {
    typeName: '__typeName',
    qualifiedName: 'qualifiedName',
    state: '__state',
    ownerUsers: 'ownerUsers',
    tags: 'atlanTags',
    hasLineage: '__hasLineage',
    updateTime: '__modificationTimestamp',
  },
};
```

### 4. Query Template Differences

**ATLAN_GOLD (metadata-quality-platform):**
```sql
SELECT
    GUID,
    ASSET_NAME,
    ASSET_TYPE,
    CONNECTOR_NAME,
    DESCRIPTION,
    OWNER_USERS,
    CERTIFICATE_STATUS,
    HAS_LINEAGE,
    TAGS,
    UPDATED_AT
FROM ATLAN_GOLD.PUBLIC.ASSETS
WHERE STATUS = 'ACTIVE'
  AND ASSET_TYPE IN ('Table', 'View', 'MaterializedView')
```

**ATLAN_ENTITY_LATEST (atlan-metadata-evaluation):**
```sql
SELECT
    __guid,
    name,
    __typeName,
    connectorName,
    description,
    ownerUsers,
    certificateStatus,
    __hasLineage,
    atlanTags,
    __modificationTimestamp
FROM ATLAN_ENTITY_LATEST
WHERE __state = 'ACTIVE'
  AND __typeName NOT IN ('AtlasGlossary', 'AtlasGlossaryTerm', ...)
```

**Resolution:** Use template literals with field mappings:

```typescript
// Generate SQL dynamically based on table configuration
function buildAssetQuery(config: MDLHConfig): string {
  const fields = FIELD_MAPPINGS[config.table];
  return `
    SELECT
      ${fields.guid || '__guid'} AS guid,
      ${fields.typeName} AS type_name,
      ...
    FROM ${config.table}
    WHERE ${fields.state} = 'ACTIVE'
  `;
}
```

---

## Unification Strategy

### Phase 1: Shared Configuration (Week 1-2)

1. **Create shared config package**
   - `config/scoring-weights.yaml` (DONE)
   - `config/field-mappings.yaml`
   - `config/mdlh-tables.yaml`

2. **Abstract table references**
   - Replace hardcoded table names with config references
   - Support both ATLAN_GOLD and ATLAN_ENTITY_LATEST

### Phase 2: Unified Query Layer (Week 2-3)

1. **Create query builder**
   - Generates SQL based on target table
   - Handles field name translation
   - Supports both backends

2. **Normalize response transformations**
   - Map responses to canonical format
   - Support both field naming conventions

### Phase 3: Scoring Reconciliation (Week 3-4)

1. **Standardize weights**
   - Agree on unified weight configuration
   - Update both repos to use shared config

2. **Align scoring logic**
   - Ensure backend and frontend calculations match
   - Add validation tests

### Phase 4: Feature Consolidation (Week 4+)

1. **Merge unique features**
   - Enrichment planning (from evaluation)
   - Time series/trends (from quality-platform)
   - Custom fields system (from evaluation)

2. **Unified API layer**
   - Single backend supporting both table schemas
   - Feature flags for repo-specific functionality

---

## Recommended Shared Config Structure

```
config/
├── scoring-weights.yaml       # Quality scoring weights
├── field-mappings.yaml        # Table → canonical field mappings
├── mdlh-config.yaml           # MDLH connection settings
├── asset-types.yaml           # Supported asset types per connector
└── completeness-rubrics.yaml  # Per-asset-type scoring rules
```

---

## Migration Checklist

### For metadata-quality-platform:

- [x] Create scoring weights config (`config/scoring-weights.yaml`)
- [x] Create backend config loader (`backend/app/scoring_config.py`)
- [x] Add DIMENSION_WEIGHTS export in frontend
- [ ] Add field mappings config
- [ ] Support ATLAN_ENTITY_LATEST table
- [ ] Add connector-based asset type filtering

### For atlan-metadata-evaluation:

- [ ] Update to use shared scoring weights
- [ ] Add support for ATLAN_GOLD.PUBLIC.ASSETS table
- [ ] Normalize query templates
- [ ] Export enrichment planning logic as shared module

---

## API Alignment

### Current APIs:

**metadata-quality-platform:**
- `GET /mdlh/assets`
- `GET /mdlh/quality-scores`
- `GET /mdlh/quality-rollup`
- `GET /mdlh/lineage/{guid}`
- `GET /mdlh/hierarchy/*`
- `GET /mdlh/lineage-metrics` (NEW)
- `GET /mdlh/snapshot` (NEW)
- `GET /mdlh/trends/coverage` (NEW)

**atlan-metadata-evaluation:**
- `GET /api/mdlh/assets`
- `GET /api/mdlh/field-coverage`
- `GET /api/mdlh/asset-breakdown`
- `GET /api/mdlh/orphan-assets`
- `GET /api/mdlh/trend-data`

### Unified API (Proposed):

```
/api/v2/assets
  - GET       List/search assets
  - GET /:id  Get asset details

/api/v2/quality
  - GET /scores           Per-asset scores
  - GET /rollup           Aggregated by dimension
  - GET /snapshot         Current state snapshot
  - GET /trends           Historical trends

/api/v2/lineage
  - GET /:id              Asset lineage
  - GET /metrics          Lineage metrics rollup

/api/v2/coverage
  - GET /fields           Field coverage stats
  - GET /orphans          Assets missing owners
  - GET /breakdown        By type/connector

/api/v2/enrichment       (from evaluation repo)
  - GET /plans            Enrichment plans
  - POST /plans           Create plan
  - GET /readiness        MCP/AI readiness scores
```

---

## Notes

- The evaluation repo has a richer entity type system (100+ types)
- Consider importing entity-dictionary.ts from evaluation
- Custom fields system should be unified
- Persona-based views could be added to quality-platform

---

## Next Steps

1. Create `config/field-mappings.yaml` with table-specific mappings
2. Update `mdlh.py` to support configurable table names
3. Create shared NPM package for configs (if monorepo)
4. Schedule cross-repo review meeting
