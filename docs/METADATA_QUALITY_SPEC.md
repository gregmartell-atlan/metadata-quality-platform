# Metadata Quality Platform

## Unified Technical Specification (v1)

### 0. Purpose & Scope
This document defines the Metadata Quality Platform built on Atlan, including:
- Full asset hierarchy coverage (Connections → Databases → Schemas → Tables)
- Configurable, policy-driven quality scoring
- Two scoring models:
  - Industry 5-Dimension Quality Model
  - Standard Metadata Completeness Model (baseline)
- How Atlan APIs and attributes power each metric
- How scores feed pivots, campaigns, automation, and dashboards

This spec intentionally avoids speculative fields and uses only what Atlan APIs expose today, with clear extension points.

---

### 1. Asset Hierarchy Covered
The platform MUST support scoring and aggregation across the full Atlan hierarchy:

Connection
 └── Database
     └── Schema
         └── Table

Each level is independently scorable but also rolls up into higher levels.

---

### 2. Scoring Architecture Overview
#### 2.1 Core Concepts
- **Scoring Profile**: Defines what dimensions/checks exist and how they are calculated.
- **Quality Configuration**: Defines weights, thresholds, applicability, and overrides by domain, asset type, or connection.
- **Scoring Engine**: Executes profiles against Atlan assets using Search + Lineage APIs.

#### 2.2 Required Profiles (v1)
| Profile                | Purpose                                 |
|------------------------|-----------------------------------------|
| industry5d             | Rich, weighted governance maturity score |
| standardCompleteness   | Simple, explainable baseline completeness score |

Both profiles MAY be computed simultaneously.

---

### 3. Atlan Data Inputs (Authoritative)
#### 3.1 Shared Asset Attributes (all hierarchy levels)
Used across all dimensions:
- **Identity & grouping**: guid, typeName, name, qualifiedName, connectionName, connectionQualifiedName, domainGUIDs
- **Documentation & governance**: description, userDescription, ownerUsers, ownerGroups, certificateStatus, certificateUpdatedAt, classifications, classificationNames, meanings (glossary terms), readme (relationship), isDiscoverable, isAIGenerated
- **Freshness & activity**: createTime, updateTime, sourceCreatedAt, sourceUpdatedAt, sourceLastReadAt, lastSyncRunAt, lastRowChangedAt
- **Usage & engagement**: popularityScore, viewScore, starredCount, sourceReadCount, sourceReadUserCount
- **Lineage**: __hasLineage (fast proxy), Lineage API (depth=1 BOTH, batched)

#### 3.2 Asset-specific additions
- **Connection**: allowQuery, allowQueryPreview, hasPopularityInsights, category, subCategory
- **Database**: schemaCount
- **Schema**: tableCount, viewsCount, linkedSchemaQualifiedName
- **Table**: databaseQualifiedName, schemaQualifiedName, rowCount, sizeBytes, isProfiled, lastProfiledAt, queryCount, queryUserCount, tableType

---

### 4. Quality Dimensions (Industry 5-Dimension Model)
#### 4.1 Completeness (30%)
Goal: Is the minimum required metadata present?
- Checks: description, owner, certification, classifications, glossary terms, README, domain, lineage
- Scoring: Presence-based, weighted sum → 0–100

#### 4.2 Accuracy (25%)
Goal: Does the metadata look trustworthy?
- Checks: certification strength, naming convention compliance, owner plausibility, classification plausibility, AI-generated metadata flagged for review

#### 4.3 Timeliness (20%)
Goal: How stale is metadata and/or the asset itself?
- Signals: metadata freshness, source freshness, data change proxy, certification age, usage recency, profiling recency
- Scoring: Decay curves or staleness bands

#### 4.4 Consistency (15%)
Goal: Does metadata conform to governance rules?
- Checks: taxonomy allowlists, domain ↔ glossary alignment, hierarchy consistency, cross-system consistency

#### 4.5 Usability (10%)
Goal: Is this asset discoverable and actually used?
- Signals: description quality heuristics, searchability proxy, engagement, consumption, discoverability gate

---

### 5. Standard Metadata Completeness Profile (Baseline)
#### 5.1 Purpose
Provide a boring, defensible, universal completeness score.
#### 5.2 Checks (example: Tables)
| Check                | Points |
|----------------------|--------|
| Description present  | 30     |
| Owner present        | 25     |
| Certified            | 15     |
| Classified           | 10     |
| Glossary terms       | 10     |
| Lineage present      | 10     |

Score = Σ(points earned)
- No weighting
- No decay
- Easy to explain
- Used internally for campaigns even if hidden from UI

---

### 6. Quality Configuration System
#### 6.1 Config Capabilities
- Enable/disable checks
- Override weights per domain, asset type, connection
- Define naming regex rules
- Define staleness thresholds
- Version configs (for trend integrity)

#### 6.2 Example Config Shape
```json
{
  "version": "v1",
  "activeProfiles": ["industry5d", "standardCompleteness"],
  "bands": { "excellent": 80, "good": 60, "fair": 40, "poor": 20 },
  "domains": {
    "Financial": {
      "industry5d": {
        "dimensionWeights": {
          "accuracy": 0.40,
          "consistency": 0.25
        }
      }
    }
  }
}
```

---

### 7. Aggregation & Rollups
- Scores computed per asset
- Rollups supported: Table → Schema → Database → Connection
- Rollup strategies: Average, Weighted by rowCount / usage, Worst-case (for governance reporting)

---

### 8. Pivots, Campaigns, Automation
#### 8.1 Pivots
- Dimensions: asset type, connection, domain, owner group, score band (by profile)
- Measures: avgScore(profile), pctFail(checkId)

#### 8.2 Campaigns
- Triggered by: profile score thresholds, failed checks
- Workflow: New → Assigned → In Progress → Validation → Resolved (+ Escalated)

#### 8.3 Automation
- Triggers: asset_created, asset_updated, score_changed, schedule
- Actions: set_metadata, propagate_from_lineage, create_task, send_alert, run_classification

---

### 9. API Usage Strategy
- **Search API**: Primary data source for scoring
- **Lineage API**: Used selectively for lineage depth, orphan detection
- **Atlas API**: Used to apply remediation outcomes, propagate metadata
- **Events API**: Used for incremental rescoring, automation triggers

---

### 10. Design Principles (Non-Negotiable)
- Everything is config-driven
- No hardcoded governance rules
- Explainability beats cleverness
- Completeness before accuracy
- Proxy accuracy is acceptable (but labeled as such)

---

### 11. Future Extensions (Explicitly Out of v1)
- True data correctness validation
- External schema diffing
- Column-level semantic accuracy
- ML confidence-weighted classifications

---

### Final note
This spec is intentionally opinionated but realistic. It uses what Atlan already gives you, avoids magical thinking, and scales from “we need something now” to “enterprise governance monster” without a rewrite.
