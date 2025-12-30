# Atlan Integration Service

This service provides authentication, asset fetching, and data transformation for integrating with Atlan APIs. It's based on the working implementation from `atlan-metadata-designer`.

## Setup

### 1. Install Dependencies

The proxy server requires `express` and `cors`:

```bash
npm install
```

### 2. Start the Proxy Server

The proxy server is required to avoid CORS issues when calling Atlan APIs from the browser:

```bash
npm run proxy
```

The proxy server runs on `http://localhost:3002` by default (configurable via `PROXY_PORT` environment variable).

### 3. Configure Environment Variables

Create a `.env` file (optional, defaults are provided):

```env
VITE_PROXY_URL=http://localhost:3002
```

## Usage

### Authentication

```typescript
import { configureAtlanApi, testConnection } from './services/atlan';

// Configure with your Atlan credentials
configureAtlanApi({
  baseUrl: 'https://your-company.atlan.com',
  apiKey: 'your-api-key',
});

// Test the connection
const status = await testConnection();
if (status.connected) {
  console.log('Connected to Atlan!');
} else {
  console.error('Connection failed:', status.error);
}
```

### Fetching Assets

```typescript
import { fetchAssetsForModel, searchByType, getAssetsByConnection } from './services/atlan';

// Fetch tables from a specific connector
const tables = await fetchAssetsForModel({
  assetTypes: ['Table'],
  connector: 'snowflake',
  size: 100,
});

// Search by asset type
const databases = await searchByType('Database', {}, 50);

// Get all assets for a connection
const assets = await getAssetsByConnection(
  'default/snowflake/1234567890',
  ['Database', 'Schema', 'Table']
);
```

### Transforming Assets

```typescript
import { transformAtlanAssets, calculateAssetQuality } from './services/atlan';
import { calculateAssetQuality } from './services/qualityMetrics';

// Fetch and transform assets
const atlanAssets = await fetchAssetsForModel({ assetTypes: ['Table'] });
const metadata = transformAtlanAssets(atlanAssets);

// Calculate quality scores
const scores = metadata.map(asset => calculateAssetQuality(asset));
```

### Advanced Search

```typescript
import { searchAssets } from './services/atlan';

// Custom search query
const response = await searchAssets(
  {
    bool: {
      must: [
        { term: { '__typeName.keyword': 'Table' } },
        { term: { 'connectorName.keyword': 'snowflake' } },
      ],
    },
  },
  ['name', 'description', 'ownerUsers', 'certificateStatus'],
  100,
  0
);

console.log(`Found ${response.approximateCount} assets`);
```

### Lineage

```typescript
import { getLineage } from './services/atlan';

// Get upstream and downstream lineage
const lineage = await getLineage(
  'asset-guid-here',
  'both', // 'upstream', 'downstream', or 'both'
  3 // depth
);
```

## API Reference

### Configuration

- `configureAtlanApi(config: AtlanApiConfig)` - Configure the API client
- `getAtlanConfig()` - Get current configuration
- `isConfigured()` - Check if API is configured
- `clearAtlanConfig()` - Clear configuration (logout)
- `testConnection()` - Test the connection
- `testAtlanConnection({ apiKey, baseUrl })` - Test with provided credentials

### Asset Fetching

- `fetchAssetsForModel(options?)` - Fetch assets with filters
- `searchAssets(query, attributes?, limit?, offset?)` - Execute custom search
- `searchByType(typeName, filters?, limit?, offset?)` - Search by asset type
- `getAssetsByConnection(connectionQualifiedName, assetTypes?, limit?)` - Get assets by connection
- `getAsset(guid, attributes?)` - Get single asset by GUID
- `getLineage(guid, direction?, depth?)` - Get lineage for an asset

### Transformation

- `transformAtlanAsset(asset)` - Transform single Atlan asset to AssetMetadata
- `transformAtlanAssets(assets)` - Transform multiple assets
- `extractHierarchy(assets)` - Extract hierarchy (connections, databases, schemas, tables)

### Caching

- `clearCache()` - Clear response cache
- `resetAtlanAssetCache()` - Reset asset cache

## Architecture

The service uses a proxy server pattern to avoid CORS issues:

1. **Frontend** → Makes requests to `http://localhost:3002/proxy/api/...`
2. **Proxy Server** → Forwards requests to Atlan with proper headers
3. **Atlan API** → Returns data to proxy
4. **Proxy Server** → Returns data to frontend

The proxy server:
- Handles CORS
- Adds authentication headers (`X-Atlan-URL` and `X-Atlan-API-Key`)
- Provides error handling and logging
- Supports request cancellation

## Quality Metrics Integration

The transformer converts Atlan assets to the `AssetMetadata` format used by the quality metrics system. It maps:

- **Completeness**: description, ownerUsers, ownerGroups, certificateStatus, classificationNames, meanings, domainGUIDs, __hasLineage
- **Accuracy**: certificateStatus, certificateUpdatedAt, naming conventions
- **Timeliness**: updateTime, sourceUpdatedAt, sourceLastReadAt, lastRowChangedAt, lastProfiledAt
- **Consistency**: domainGUIDs, naming conventions, hierarchy consistency
- **Usability**: popularityScore, viewScore, starredCount, sourceReadCount, queryCount, isDiscoverable

## Notes

- API keys are never stored in localStorage (only in memory)
- Base URL is stored in sessionStorage for convenience
- Responses are cached for 60 seconds
- The proxy server must be running for the integration to work
- All requests support AbortController for cancellation






