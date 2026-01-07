# Metadata Quality Platform - Developer Guide

## Architecture Overview

The platform fetches assets from Atlan, calculates quality scores across 5 dimensions, and provides various views for analysis.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────────┐       │
│  │  Atlan API   │───▶│  API Service    │───▶│  Context Loader   │       │
│  │  (via proxy) │    │  (api.ts)       │    │                   │       │
│  └──────────────┘    └─────────────────┘    └─────────┬─────────┘       │
│                                                        │                 │
│                                                        ▼                 │
│                      ┌─────────────────┐    ┌───────────────────┐       │
│                      │  Transformer    │◀───│  Context Store    │       │
│                      │  (transformer)  │    │  (assetContext)   │       │
│                      └────────┬────────┘    └───────────────────┘       │
│                               │                                          │
│                               ▼                                          │
│                      ┌─────────────────┐    ┌───────────────────┐       │
│                      │  Quality        │───▶│  Scores Store     │       │
│                      │  Metrics        │    │  (scoresStore)    │       │
│                      └─────────────────┘    └─────────┬─────────┘       │
│                                                        │                 │
│                                                        ▼                 │
│                                              ┌───────────────────┐       │
│                                              │   UI Components   │       │
│                                              │   (Dashboard,     │       │
│                                              │    Pivot, etc.)   │       │
│                                              └───────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Atlan API Service (`src/services/atlan/api.ts`)

### Configuration

```typescript
import { configureAtlanApi, isConfigured, testConnection } from './services/atlan/api';

// Configure the API client
configureAtlanApi({
  baseUrl: 'https://your-instance.atlan.com',
  apiKey: 'your-api-key'
});

// Check if configured
if (isConfigured()) {
  const status = await testConnection();
  console.log('Connected:', status.connected);
}
```

### Key Functions

#### `fetchAssetsForModel(options)`
Fetches assets with flexible filtering:

```typescript
import { fetchAssetsForModel } from './services/atlan/api';

const assets = await fetchAssetsForModel({
  connector: 'snowflake',           // Filter by connector
  databaseQualifiedName: '...',     // Filter by database
  schemaQualifiedName: '...',       // Filter by schema
  assetTypes: ['Table', 'View'],    // Asset types to include
  size: 1000,                       // Max results
  from: 0                           // Pagination offset
});
```

#### `getConnectors()`
Returns available connectors with asset counts:

```typescript
import { getConnectors } from './services/atlan/api';

const connectors = await getConnectors();
// Returns: [{ id: 'snowflake', name: 'snowflake', assetCount: 1500, isActive: true }]
```

#### `getDatabases(connector)` / `getSchemas(databaseQN)`
Navigate the hierarchy:

```typescript
import { getDatabases, getSchemas } from './services/atlan/api';

const databases = await getDatabases('snowflake');
const schemas = await getSchemas(databases[0].qualifiedName);
```

#### `searchAssets(query, attributes, limit, offset)`
Execute raw DSL queries:

```typescript
import { searchAssets } from './services/atlan/api';

const response = await searchAssets({
  bool: {
    must: [
      { term: { 'connectorName': 'snowflake' } },
      { exists: { field: 'description' } }
    ],
    must_not: [
      { term: { '__state': 'DELETED' } }
    ]
  }
}, [], 100, 0);
```

---

## 2. Asset Types (`src/services/atlan/types.ts`)

```typescript
// Core asset interface
export interface AtlanAsset {
  // Identity
  guid: string;
  typeName: string;
  name: string;
  qualifiedName: string;
  connectionName?: string;

  // Governance
  description?: string;
  userDescription?: string;
  ownerUsers?: string[];
  ownerGroups?: string[];
  certificateStatus?: 'VERIFIED' | 'DRAFT' | 'DEPRECATED' | null;
  classificationNames?: string[];
  atlanTags?: AtlanTag[];
  meanings?: Array<{ guid: string; displayText: string }>;
  domainGUIDs?: string[];

  // Timeliness
  updateTime?: number;
  sourceUpdatedAt?: number;
  lastRowChangedAt?: number;

  // Usability
  popularityScore?: number;
  viewScore?: number;
  starredCount?: number;
  __hasLineage?: boolean;
  readme?: { guid: string; content?: string };
}
```

---

## 3. Context Management (`src/stores/assetContextStore.tsx`)

### Context Types

```typescript
type AssetContextType = 'all' | 'connection' | 'database' | 'schema' | 'table' | 'manual';

interface AssetContextFilters {
  connectionName?: string;
  databaseName?: string;
  schemaName?: string;
  tableName?: string;
  assetGuid?: string;
}
```

### Usage

```typescript
import { useAssetContextStore } from './stores/assetContextStore';

function MyComponent() {
  const {
    context,           // Current context info
    contextAssets,     // Assets matching context
    setContext,        // Set new context
    clearContext,      // Clear context
    isLoading,
    error
  } = useAssetContextStore();

  // Set context for a connection
  const handleSelectConnection = async (connectionName: string) => {
    const assets = await loadAssetsForConnection(connectionName);
    setContext('connection', { connectionName }, connectionName, assets);
  };
}
```

---

## 4. Asset Context Loader (`src/utils/assetContextLoader.ts`)

High-level functions for loading assets by context:

```typescript
import {
  loadAssetsForContext,
  loadAssetsForConnection,
  loadAssetsForDatabase,
  loadAssetsForSchema,
  generateContextLabel
} from './utils/assetContextLoader';

// Load by context type
const assets = await loadAssetsForContext('connection', {
  connectionName: 'snowflake'
});

// Generate human-readable label
const label = generateContextLabel('database', {
  connectionName: 'snowflake',
  databaseName: 'ANALYTICS'
});
// Returns: "snowflake > ANALYTICS"
```

---

## 5. Asset Transformer (`src/services/atlan/transformer.ts`)

Converts Atlan assets to internal `AssetMetadata` format:

```typescript
import { transformAtlanAsset, transformAtlanAssetsWithNames } from './services/atlan/transformer';

// Single asset (synchronous)
const metadata = transformAtlanAsset(atlanAsset);

// Multiple assets with resolved domain/tag names (async)
const metadataList = await transformAtlanAssetsWithNames(atlanAssets);
```

### AssetMetadata Structure

```typescript
interface AssetMetadata {
  // Core identification
  id: string;
  name: string;
  assetType: string;
  connection: string;
  domain?: string;
  owner?: string;
  ownerGroup?: string;

  // Completeness factors
  description?: string;
  descriptionLength?: number;
  tags?: string[];
  customProperties?: Record<string, any>;

  // Accuracy factors
  lastValidated?: Date;
  validationErrors?: number;
  businessGlossaryMatch?: boolean;

  // Timeliness factors
  lastUpdated?: Date;
  lastProfiled?: Date;
  stalenessThreshold?: number;

  // Consistency factors
  namingConvention?: string;
  domainConsistency?: number;

  // Usability factors
  certificationStatus?: 'certified' | 'draft' | 'deprecated' | 'none';
  hasLineage?: boolean;
  hasDocumentation?: boolean;
  searchable?: boolean;
}
```

---

## 6. Quality Scoring (`src/services/qualityMetrics.ts`)

### Five Dimensions

| Dimension | Weight | Key Factors |
|-----------|--------|-------------|
| **Completeness** | 30% | Description, owner, tags, custom properties, column docs |
| **Accuracy** | 25% | Schema validation, data types, glossary alignment |
| **Timeliness** | 20% | Last updated, schema changes, profiling recency |
| **Consistency** | 15% | Naming conventions, field consistency, domain alignment |
| **Usability** | 10% | Certification, lineage, documentation, searchability |

### Scoring Functions

```typescript
import {
  calculateAssetQuality,
  calculateCompleteness,
  calculateAccuracy,
  calculateTimeliness,
  calculateConsistency,
  calculateUsability,
  aggregateQualityScores
} from './services/qualityMetrics';

// Calculate all scores for a single asset
const scores = calculateAssetQuality(assetMetadata);
// Returns: { completeness: 85, accuracy: 70, timeliness: 60, consistency: 75, usability: 80, overall: 74 }

// Calculate individual dimension
const completeness = calculateCompleteness(assetMetadata);

// Aggregate across multiple assets
const avgScores = aggregateQualityScores(assetMetadataArray);
```

### Completeness Calculation Example

```typescript
function calculateCompleteness(asset: AssetMetadata): number {
  let score = 0;
  let maxScore = 0;

  // Description (30% weight)
  maxScore += 30;
  if (asset.description) {
    const descLength = asset.descriptionLength || asset.description.length;
    if (descLength >= 100) score += 30;      // Full points for substantial description
    else if (descLength >= 50) score += 20;  // Partial for medium
    else if (descLength > 0) score += 10;    // Minimal for short
  }

  // Owner assignment (25% weight)
  maxScore += 25;
  if (asset.owner || asset.ownerGroup) score += 25;

  // Tags (15% weight)
  maxScore += 15;
  if (asset.tags?.length > 0) {
    score += Math.min(15, asset.tags.length * 3); // 3 points per tag, max 15
  }

  // ... more factors

  return Math.round((score / maxScore) * 100);
}
```

---

## 7. Scores Store (`src/stores/scoresStore.tsx`)

Central store for calculated scores with grouping capabilities:

```typescript
import { useScoresStore } from './stores/scoresStore';

function Dashboard() {
  const {
    assetsWithScores,      // Array of { asset, metadata, scores }
    setAssetsWithScores,   // Calculate scores for assets
    clearScores,           // Clear all scores
    stats,                 // Aggregated stats
    byOwner,               // Grouped by owner
    byConnection,          // Grouped by connection
    byDomain,              // Grouped by domain
    bySchema,              // Grouped by schema
    byTag,                 // Grouped by tag
    byCertification,       // Grouped by certification status
    groupBy                // Generic grouping function
  } = useScoresStore();

  // Calculate scores for loaded assets
  useEffect(() => {
    if (contextAssets.length > 0) {
      setAssetsWithScores(contextAssets);
    }
  }, [contextAssets]);

  // Access grouped data
  const snowflakeAssets = byConnection.get('snowflake') || [];
  const certifiedAssets = byCertification.get('Certified') || [];

  // Custom grouping
  const byAssetType = groupBy('assetType');
}
```

### Stats Object

```typescript
const stats = {
  assetsWithDescriptions: number,  // Count with descriptions
  assetsWithOwners: number,        // Count with owners
  staleAssets: number,             // Count older than 90 days
  certifiedAssets: number          // Count with VERIFIED status
};
```

---

## 8. Complete Integration Example

```typescript
import { configureAtlanApi, isConfigured } from './services/atlan/api';
import { loadAssetsForContext, generateContextLabel } from './utils/assetContextLoader';
import { useAssetContextStore } from './stores/assetContextStore';
import { useScoresStore } from './stores/scoresStore';

// 1. Configure API
configureAtlanApi({ baseUrl: '...', apiKey: '...' });

// 2. In a React component
function QualityDashboard() {
  const { setContext, setLoading } = useAssetContextStore();
  const { setAssetsWithScores, assetsWithScores, stats, byConnection } = useScoresStore();

  const loadConnection = async (connectionName: string) => {
    setLoading(true);
    try {
      // 3. Load assets
      const assets = await loadAssetsForContext('connection', { connectionName });

      // 4. Set context (stores assets)
      const label = generateContextLabel('connection', { connectionName });
      setContext('connection', { connectionName }, label, assets);

      // 5. Calculate scores (transforms + scores)
      await setAssetsWithScores(assets);

    } finally {
      setLoading(false);
    }
  };

  // 6. Use scored data
  return (
    <div>
      <h1>Quality Score: {calculateOverallAverage(assetsWithScores)}%</h1>
      <p>Assets with descriptions: {stats.assetsWithDescriptions}</p>
      <p>Certified assets: {stats.certifiedAssets}</p>

      {/* Group by connection */}
      {Array.from(byConnection.entries()).map(([conn, assets]) => (
        <div key={conn}>
          {conn}: {assets.length} assets,
          avg score: {average(assets.map(a => a.scores.overall))}%
        </div>
      ))}
    </div>
  );
}
```

---

## 9. File Structure

```
src/
├── services/
│   ├── atlan/
│   │   ├── api.ts           # Atlan API client
│   │   ├── types.ts         # Type definitions
│   │   ├── transformer.ts   # Asset transformation
│   │   ├── domainResolver.ts
│   │   ├── tagResolver.ts
│   │   └── lineageEnricher.ts
│   ├── qualityMetrics.ts    # Scoring algorithms
│   └── scoringService.ts    # Config-driven scoring
│
├── stores/
│   ├── assetContextStore.tsx  # Context management
│   ├── scoresStore.tsx        # Calculated scores
│   ├── assetStore.tsx         # Raw assets
│   └── sessionStore.ts        # Session persistence
│
├── utils/
│   ├── assetContextLoader.ts  # High-level loaders
│   ├── apiClient.ts           # HTTP client with retry
│   ├── crossTabSync.ts        # Multi-tab sync
│   └── logger.ts              # Logging utility
│
└── components/
    ├── dashboard/             # Dashboard widgets
    ├── pivot/                 # Pivot builder
    └── home/                  # Home page components
```

---

## 10. Environment Variables

```bash
# Proxy mode (default for local dev)
VITE_PROXY_HOST=localhost        # Proxy server host
VITE_PROXY_URL=http://localhost:3002  # Full proxy URL

# App Framework mode (for Atlan App deployment)
VITE_APP_FRAMEWORK_MODE=true     # Enable App Framework mode

# Workflow API (optional)
VITE_WORKFLOW_API_URL=http://localhost:8000
```

---

## 11. Running the Platform

```bash
# Install dependencies
npm install

# Start proxy server (required for API calls)
npm run proxy

# Start development server
npm run dev

# Run tests
npm test
```

The proxy server runs on port 3002 and forwards requests to your Atlan instance with the provided credentials.
