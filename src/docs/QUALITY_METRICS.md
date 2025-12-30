# Quality Metrics Calculation Guide

This document explains the underlying calculations and metrics that drive the five quality dimensions in the Metadata Quality Platform.

## Overview

Each asset receives scores (0-100) for five dimensions:
- **Completeness** - How fully documented the asset is
- **Accuracy** - How correct and validated the metadata is
- **Timeliness** - How up-to-date the metadata is
- **Consistency** - How consistent metadata is across assets
- **Usability** - How useful and accessible the metadata is

The **Overall** score is the simple average of all five dimensions.

---

## 1. Completeness (0-100)

**Purpose**: Measures how fully documented an asset is.

### Calculation Factors:

| Factor | Weight | Scoring Logic |
|--------|--------|---------------|
| **Description** | 30% | - 100+ chars: 30 points<br>- 50-99 chars: 20 points<br>- 1-49 chars: 10 points<br>- Missing: 0 points |
| **Owner Assignment** | 25% | - Has owner or owner group: 25 points<br>- Missing: 0 points |
| **Tags** | 15% | - 3 points per tag (max 15)<br>- No tags: 0 points |
| **Custom Properties** | 10% | - 3+ properties: 10 points<br>- 1-2 properties: 5 points<br>- None: 0 points |
| **Column Documentation** | 20% | - For tables: % of columns with descriptions<br>- For other assets: Full points if description + owner exist |

### Example:
- Asset has 150-char description → 30 points
- Has owner → 25 points
- Has 3 tags → 9 points
- Has 2 custom properties → 5 points
- Table with 80% columns documented → 16 points
- **Total: 85/100 = 85%**

---

## 2. Accuracy (0-100)

**Purpose**: Measures how correct and validated the metadata is.

### Calculation Factors:

| Factor | Weight | Scoring Logic |
|--------|--------|---------------|
| **Schema Matches Source** | 30% | - Matches: 30 points<br>- Doesn't match: 0 points<br>- Unknown: 15 points |
| **Data Type Accuracy** | 25% | - Direct metric (0-100%) scaled to 25 points<br>- Unknown: 12.5 points |
| **Business Glossary Match** | 20% | - Matches: 20 points<br>- Doesn't match: 0 points<br>- Unknown: 10 points |
| **Validation Errors** | 15% | - 0 errors: 15 points<br>- 1-2 errors: 10 points<br>- 3-5 errors: 5 points<br>- 6+ errors: 0 points |
| **Recent Validation** | 10% | - Validated ≤30 days ago: 10 points<br>- 31-90 days: 5 points<br>- 90+ days: 0 points |

### Example:
- Schema matches source → 30 points
- Data type accuracy: 80% → 20 points
- Matches business glossary → 20 points
- 1 validation error → 10 points
- Validated 15 days ago → 10 points
- **Total: 90/100 = 90%**

---

## 3. Timeliness (0-100)

**Purpose**: Measures how up-to-date the metadata is.

### Calculation Factors:

| Factor | Weight | Scoring Logic |
|--------|--------|---------------|
| **Last Updated** | 40% | - ≤7 days: 40 points<br>- 8-30 days: 30 points<br>- 31-90 days: 20 points<br>- 90+ days: 0 points |
| **Schema Change Detection** | 25% | - Schema stable or metadata updated after change: 25 points<br>- Schema changed, metadata not updated: 5 points<br>- Unknown: 12.5 points |
| **Metadata Refresh Frequency** | 20% | - Refreshed ≤7 days: 20 points<br>- 8-30 days: 15 points<br>- 31-90 days: 10 points<br>- 90+ days: 0 points |
| **Last Profiled** | 15% | - Profiled ≤30 days: 15 points<br>- 31-90 days: 10 points<br>- 91-180 days: 5 points<br>- 180+ days: 0 points |

### Example:
- Updated 5 days ago → 40 points
- Schema stable → 25 points
- Refreshed 10 days ago → 15 points
- Profiled 20 days ago → 15 points
- **Total: 95/100 = 95%**

---

## 4. Consistency (0-100)

**Purpose**: Measures how consistent metadata is across assets and domains.

### Calculation Factors:

| Factor | Weight | Scoring Logic |
|--------|--------|---------------|
| **Naming Convention** | 30% | - Matches pattern: 30 points<br>- Partial match: 10 points<br>- Has convention but no pattern: 15 points<br>- No convention: 0 points |
| **Field Name Consistency** | 25% | - Direct metric (0-100%) scaled to 25 points<br>- Unknown: 12.5 points |
| **Data Type Consistency** | 20% | - Direct metric (0-100%) scaled to 20 points<br>- Unknown: 10 points |
| **Format Consistency** | 15% | - Direct metric (0-100%) scaled to 15 points<br>- Unknown: 7.5 points |
| **Domain Consistency** | 10% | - Direct metric (0-100%) scaled to 10 points<br>- Has domain but no metric: 5 points |

### Example:
- Matches naming pattern → 30 points
- Field name consistency: 70% → 17.5 points
- Data type consistency: 80% → 16 points
- Format consistency: 60% → 9 points
- Domain consistency: 90% → 9 points
- **Total: 81.5/100 = 82%**

---

## 5. Usability (0-100)

**Purpose**: Measures how useful and accessible the metadata is.

### Calculation Factors:

| Factor | Weight | Scoring Logic |
|--------|--------|---------------|
| **Certification Status** | 30% | - Certified: 30 points<br>- Draft: 15 points<br>- Deprecated: 5 points<br>- None: 0 points |
| **Lineage Coverage** | 25% | - Full lineage (upstream + downstream): 25 points<br>- Partial lineage: 15 points<br>- No lineage: 0 points<br>- Unknown: 5 points |
| **Documentation Quality** | 20% | - Direct metric (0-100%) scaled to 20 points<br>- Has docs but no metric: 15 points<br>- No docs: 0 points |
| **Searchability** | 15% | - Explicitly searchable: 15 points<br>- Implicitly searchable (has description + tags): 15 points<br>- Has description only: 10 points<br>- Not searchable: 0 points |
| **Business Context** | 10% | - Has business context: 10 points<br>- Implicit context (owner + description): 10 points<br>- Partial context: 5 points<br>- No context: 0 points |

### Example:
- Certified → 30 points
- Full lineage → 25 points
- Documentation quality: 85% → 17 points
- Searchable with description + tags → 15 points
- Has business context → 10 points
- **Total: 97/100 = 97%**

---

## Aggregation

### Asset-Level Scores
Each asset's scores are calculated independently using the formulas above.

### Domain/Connection-Level Scores
Aggregated scores are calculated as the **average** of all assets in that domain/connection.

### Overall Score
The overall score is the simple **average** of all five dimension scores:
```
Overall = (Completeness + Accuracy + Timeliness + Consistency + Usability) / 5
```

---

## Implementation

The calculation logic is implemented in:
- `src/services/qualityMetrics.ts` - Core calculation functions
- `src/services/mockData.ts` - Mock data for development

### Usage Example:
```typescript
import { calculateAssetQuality } from './services/qualityMetrics';

const asset: AssetMetadata = {
  id: 'asset-1',
  name: 'customer_transactions',
  description: 'Contains all customer transaction records...',
  owner: 'jane.doe@company.com',
  tags: ['customer', 'transactions', 'financial'],
  // ... other properties
};

const scores = calculateAssetQuality(asset);
// Returns: { completeness: 85, accuracy: 90, timeliness: 95, consistency: 82, usability: 97, overall: 90 }
```

---

## Customization

The weights and thresholds can be customized per organization by:
1. Modifying the weight percentages in `qualityMetrics.ts`
2. Adjusting staleness thresholds (default: 90 days)
3. Adding organization-specific factors
4. Implementing custom validation rules

---

## Notes

- All scores are rounded to the nearest integer
- Missing data receives partial credit (typically 50% of max) to avoid penalizing unknown states
- The system is designed to be forgiving - partial information still contributes to scores
- In production, these calculations would be run server-side and cached for performance

