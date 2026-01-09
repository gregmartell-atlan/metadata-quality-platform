# Snowflake Loading Issues - Analysis

## Problem Statement
"Pivot fixed for BigQuery, but still Snowflake issues"

## Potential Root Causes

### 1. **Case Sensitivity in Connector Names**

**Location**: `src/services/atlan/api.ts:1423`

```typescript
{ term: { 'connectorName': connector } }
```

This does an **exact match** on `connectorName`. If:
- User selects `"Snowflake"` (capitalized)
- But Atlan stores it as `"snowflake"` (lowercase)
- Or stores it as `"SNOWFLAKE"` (uppercase)

**No databases will be returned!**

### 2. **Connector Name Variations**

Snowflake connections in Atlan might have different naming patterns:
- `"snowflake"` (lowercase)
- `"Snowflake"` (title case)
- `"SNOWFLAKE"` (uppercase)
- `"snowflake-prod"` (with suffix)
- `"Snowflake Production"` (with description)

BigQuery might work because its naming is more consistent.

### 3. **QualifiedName Format Differences**

Snowflake qualified names have a specific format:
```
default/snowflake/1234567890/DATABASE_NAME
```

If the connector parameter doesn't match the connection segment in qualified names, filtering breaks.

---

## Diagnostic Steps

### Step 1: Check Actual Connector Names

Add logging to see what Atlan actually returns:

```typescript
// In getDatabases function
export async function getDatabases(connector: string): Promise<HierarchyItem[]> {
  console.log('🔍 getDatabases called with:', connector);

  const response = await search(query);

  console.log('📊 Found databases:', response?.entities?.length);
  console.log('🏷️ Sample connectorNames:',
    response?.entities?.slice(0, 3).map(e => e.attributes.connectorName)
  );

  // ... rest of function
}
```

### Step 2: Check Console in Browser

1. Open DevTools (F12)
2. Click Snowflake connection
3. Look for logs showing:
   - Input parameter: `"Snowflake"`
   - Actual values in response: `"snowflake"` or other

---

## Recommended Fixes

### Fix 1: Case-Insensitive Matching (Safest)

**File**: `src/services/atlan/api.ts:1411-1468`

```typescript
export async function getDatabases(connector: string): Promise<HierarchyItem[]> {
  if (!isConfigured()) {
    throw new Error('Atlan API not configured');
  }

  // NORMALIZE: Convert to lowercase for matching
  const normalizedConnector = connector.toLowerCase();

  const query = {
    dsl: {
      size: 100,
      query: {
        bool: {
          must: [
            // Use match query instead of term for case-insensitive
            {
              match: {
                'connectorName': {
                  query: normalizedConnector,
                  operator: 'and'
                }
              }
            },
            {
              terms: {
                '__typeName.keyword': [
                  'Database',
                  'SnowflakeDatabase',
                  'DatabricksDatabase',
                  'BigQueryDataset',
                  'RedshiftDatabase',
                ],
              },
            },
          ],
          must_not: [{ term: { '__state': 'DELETED' } }],
        },
      },
    },
    // ... rest of query
  };

  // OR: Use wildcard/prefix matching
  const query = {
    dsl: {
      query: {
        bool: {
          must: [
            {
              wildcard: {
                'connectorName': {
                  value: `*${normalizedConnector}*`,
                  case_insensitive: true
                }
              }
            },
            // ... type filters
          ]
        }
      }
    }
  };
}
```

### Fix 2: Get Connector Names from Response

Instead of using the user-input name, extract the actual `connectorName` from Atlan responses:

```typescript
// In handleSelectConnection:
const handleSelectConnection = async (connName: string) => {
  const assets = await loadAssetsForContext('connection', { connectionName: connName });

  // Extract actual connector name from first asset
  const actualConnectorName = assets[0]?.connectionName || connName;

  setSelectedConnection(actualConnectorName); // Use this for subsequent calls
  // ...
};
```

### Fix 3: Debug Current State

Add a debug component to show what's actually in Atlan:

```typescript
// Temporary debug: What connectorNames exist in loaded assets?
useEffect(() => {
  if (contextAssets.length > 0) {
    const uniqueConnectors = new Set(
      contextAssets.map(a => a.connectionName).filter(Boolean)
    );
    console.log('🔍 Unique connectionNames in context:', Array.from(uniqueConnectors));
  }
}, [contextAssets]);
```

---

## Snowflake-Specific Considerations

### Database Name Casing
Snowflake typically uses:
- **UPPERCASE** database names: `WIDE_WORLD_IMPORTERS`, `MDLH`
- **UPPERCASE** schema names: `PUBLIC`, `INFORMATION_SCHEMA`
- **Case-sensitive** qualified names

### Type Names
Snowflake uses specific type names:
- `SnowflakeDatabase` (not `Database`)
- `SnowflakeSchema` (not `Schema`)
- `SnowflakeTable` (not `Table`)

The current query DOES include these (line 1428), so that's good!

### Connection Qualified Names
Snowflake format:
```
default/snowflake/1657275059/LANDING
         ^^^^^^^  ^^^^^^^^^^  ^^^^^^^
         connector  account    database
```

The connector segment is lowercase `snowflake`, even if the connection name shown in UI is `"Snowflake"`.

---

## Most Likely Issue

**Hypothesis**: The `connectorName` field in Atlan is **lowercase** (`"snowflake"`), but your code is passing **title case** (`"Snowflake"`).

**Evidence**:
- Line 1423 uses exact term match: `{ term: { 'connectorName': connector } }`
- No normalization happens before the query
- BigQuery works (maybe it's consistently lowercase?)

**Test**:
1. Check what `getConnectors()` returns for Snowflake
2. See if it returns `"snowflake"` or `"Snowflake"`
3. That name gets passed to `getDatabases(connector)`
4. If mismatch → no results

---

## Immediate Fix

**File**: `src/services/atlan/api.ts:1411`

```typescript
export async function getDatabases(connector: string): Promise<HierarchyItem[]> {
  if (!isConfigured()) {
    throw new Error('Atlan API not configured');
  }

  // FIX: Normalize connector name to lowercase
  const normalizedConnector = connector.toLowerCase();

  logger.debug('getDatabases called', {
    input: connector,
    normalized: normalizedConnector
  });

  const query = {
    dsl: {
      size: 100,
      query: {
        bool: {
          must: [
            // Use normalized lowercase value
            { term: { 'connectorName': normalizedConnector } },
            {
              terms: {
                '__typeName.keyword': [
                  'Database',
                  'SnowflakeDatabase',
                  // ... rest
                ],
              },
            },
          ],
          must_not: [{ term: { '__state': 'DELETED' } }],
        },
      },
    },
    // ... rest of query
  };

  const response = await search(query);

  logger.debug('getDatabases response', {
    connector: normalizedConnector,
    found: response?.entities?.length || 0
  });

  // ... rest of function
}
```

**Apply same fix to**:
- `getSchemas()` function
- `loadAssetsForContext()` function
- Any other function that filters by `connectorName`

---

## Testing Plan

### Step 1: Add Logging
Add console.logs to see what names are being used

### Step 2: Test in Browser
1. Open DevTools Console
2. Click Snowflake connection
3. Check logs:
   - `getConnectors()` returns: `"Snowflake"` or `"snowflake"`?
   - `getDatabases("Snowflake")` called with: what value?
   - Search query uses: what value?
   - Results found: how many?

### Step 3: Verify Fix
After normalization fix:
1. Click Snowflake → should load databases
2. Should see: WIDE_WORLD_IMPORTERS, MDLH, AI databases
3. Pivot should show full hierarchy

---

## Next Actions

1. **Immediate**: Add `.toLowerCase()` to `getDatabases` connector parameter
2. **Confirm**: Check console logs to verify the issue
3. **Apply**: Same fix to `getSchemas` and other functions
4. **Test**: Verify Snowflake → databases → schemas all load
5. **Document**: Add note about connector name normalization

Would you like me to implement the `.toLowerCase()` normalization fix now?
