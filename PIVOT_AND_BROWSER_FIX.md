# Pivot Configuration & Asset Browser Fix

## Issue 1: Pivot Should Show Snowflake → Multiple Databases

### Current State
- Pivot is configured with correct hierarchy: `['connection', 'database', 'schema', 'type']`
- Uses `contextAssets` from `assetContextStore`
- Problem: **No data loaded into context yet**

### Solution Steps

#### Option A: Load via UI (Recommended for User)
1. **Navigate to Home** (`/`)
2. **Click on Snowflake connection card** in "Your Connections" section
3. This will:
   - Load all Snowflake assets
   - Set context to Snowflake connection
   - Populate `contextAssets`
4. **Navigate to Pivot Builder** (`/pivot`)
5. Pivot will automatically show:
   ```
   Snowflake (connection)
   ├── WIDE_WORLD_IMPORTERS (database)
   ├── AI_DATABASE_1 (database)
   ├── AI_DATABASE_2 (database)
   └── MDLH (database)
   ```

#### Option B: Set Context Programmatically
If you want to pre-configure the pivot to always show Snowflake:

**File**: `src/pages/PivotBuilder.tsx`

Add this effect to auto-load Snowflake context:
```tsx
// Auto-load Snowflake connection if no context
useEffect(() => {
  async function loadSnowflake() {
    if (contextAssets.length === 0 && !isLoading) {
      const snowflakeAssets = await loadAssetsForContext('connection', {
        connectionName: 'snowflake'
      });
      setContext('connection', { connectionName: 'snowflake' }, 'Snowflake', snowflakeAssets);
    }
  }
  loadSnowflake();
}, []);
```

### Current Hierarchy Filter
The pivot starts with:
```tsx
hierarchyFilter: { level: 'connection' }
```

This means it shows ALL connections. To filter to Snowflake only:
```tsx
hierarchyFilter: {
  level: 'connection',
  connectionName: 'snowflake'  // Add this
}
```

### Expected Database Names
Based on your mention, these databases should appear:
- `WIDE_WORLD_IMPORTERS` (standard database)
- AI-related databases (names TBD)
- `MDLH` (Metadata Dictionary database)

---

## Issue 2: DaaP Analytics Asset Browser Not Loading Immediately

### Root Cause
The `AssetBrowserPanel` in the header:
1. Renders `AssetBrowser` only when `viewMode === 'tree'`
2. Uses `display: none` when in command mode
3. **This is actually OK** - but the issue is the AssetBrowser loads connections via `useEffect` which triggers when:
   - `connectionStatus === 'connected'`
   - `connectors.length > 0`
   - `treeData.length === 0`

### The Real Issue
Looking at line 260 in `AssetBrowser.tsx`:
```tsx
useEffect(() => {
  if (connectionStatus === 'connected' && connectors.length > 0 && treeData.length === 0) {
    loadConnections();
  }
}, [connectionStatus, connectors.length]);
```

The `loadConnections()` only triggers when these conditions are met. The problem might be:
1. **Connection status isn't 'connected' yet**
2. **Connectors array is empty**
3. **TreeData already populated from cached state**

### Fix: Ensure Immediate Loading

**File**: `src/components/AssetBrowser.tsx:149-173`

Update `loadConnections` to be called on mount if connected:

```tsx
// Load connections when component mounts if already connected
useEffect(() => {
  const checkAndLoad = async () => {
    // Check if we're configured
    if (isConfigured()) {
      setConnectionStatus('connected');

      // Load connectors
      const connectorList = await getConnectors();
      setConnectors(connectorList);

      // If tree is empty, load connections
      if (treeData.length === 0) {
        await loadConnections();
      }
    }
  };

  checkAndLoad();
}, []); // Run on mount
```

### Alternative Fix: AssetBrowserPanel Always Renders AssetBrowser

**File**: `src/components/layout/AssetBrowserPanel.tsx:64-79`

Currently:
```tsx
<div style={{ display: viewMode === 'tree' ? 'flex' : 'none', ... }}>
  <AssetBrowser ... />
</div>
```

This works, but we could ensure it's ALWAYS rendering (just hidden):

```tsx
{/* Always render AssetBrowser to ensure assets load */}
<div style={{
  display: viewMode === 'tree' ? 'flex' : 'none',
  flexDirection: 'column',
  height: '100%'
}}>
  <div className="asset-panel-search">
    <Search size={16} color="#666" />
    <input ... />
  </div>
  <AssetBrowser
    searchFilter={searchTerm}
    onAssetsLoaded={setLoadedAssets}
  />
</div>

{/* This ensures AssetBrowser mounts and loads data */}
{/* Even when hidden, it will populate loadedAssets */}
{/* Then AssetCommandCenter can use that data */}
```

**This is already how it works!** So the real issue might be elsewhere.

### Actual Issue: Check If It's Page-Specific

The problem might be that on **AnalyticsPage**, the AssetBrowserPanel in the AppHeader isn't triggering properly. Let me check if there's something preventing the loading on that specific page.

**Debugging Steps**:
1. Check if connection is established
2. Check if AssetBrowser is being rendered
3. Check console for errors
4. Verify `getConnectors()` is being called

### Quick Fix: Force Eager Loading

**File**: `src/components/layout/AssetBrowserPanel.tsx`

Add an effect to force load when panel opens:

```tsx
// Force load connections when panel opens
useEffect(() => {
  if (isOpen) {
    // Trigger AssetBrowser to load by ensuring it's visible first
    // This ensures data loads immediately when panel opens
    setViewMode('tree');
  }
}, [isOpen]);
```

---

## Implementation Priority

### For Pivot (Issue 1):
**User Action Required**: Navigate to Home → Click Snowflake card → Then go to Pivot

### For DaaP Analytics Browser (Issue 2):
**Code Fix Required**: Ensure AssetBrowser loads immediately when panel opens

Would you like me to implement the AssetBrowserPanel fix to ensure immediate loading?
