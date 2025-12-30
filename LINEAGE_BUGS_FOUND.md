# Lineage Visualization System - Bug Report

## Critical Bugs

### 1. **Infinite Recursion in getLineage API Call**
**Location:** `src/services/atlan/api.ts:1318-1322`
**Issue:** When `direction === 'both'`, the function recursively calls itself with 'both', causing infinite recursion.
**Fix:** Need to call with 'upstream' and 'downstream' explicitly, not 'both'.

### 2. **Missing Center Asset Prop**
**Location:** `src/pages/LineageViewPage.tsx:18-32`
**Issue:** `initialAsset` is set but never passed to `LineageView` component. The component relies on `useAssetStore` which may not have the asset yet.
**Fix:** Pass initialAsset as prop or use URL params directly in LineageView.

### 3. **Edge Direction Logic Bug**
**Location:** `src/utils/lineageGraph.ts:143-145`
**Issue:** Only checks direct connections to center node, doesn't handle transitive relationships correctly. An edge from A->B->C where C is center will mark A->B as upstream incorrectly.
**Fix:** Need to traverse graph to determine actual upstream/downstream relationships.

### 4. **useEffect Dependency Issue**
**Location:** `src/components/lineage/LineageView.tsx:182-186`
**Issue:** `fetchLineage` is in dependency array but it's a useCallback that depends on config properties. This can cause infinite loops or missed updates.
**Fix:** Remove fetchLineage from deps or restructure dependencies.

### 5. **State Mutation in useEffect**
**Location:** `src/components/lineage/LineageView.tsx:189-232`
**Issue:** Directly mutating graph state in useEffect can cause React Flow to lose track of node positions and cause rendering issues.
**Fix:** Create new graph object instead of mutating existing one.

## Major Bugs

### 6. **Orphaned Edges After Filtering**
**Location:** `src/components/lineage/LineageView.tsx:235-312`
**Issue:** When nodes are filtered out, edges referencing those nodes remain, causing broken connections in visualization.
**Fix:** Already handled correctly - edges are filtered based on filteredGuids.

### 7. **Duplicate SVG Defs**
**Location:** `src/components/lineage/LineageEdge.tsx:93-99`
**Issue:** Each edge creates its own `<defs>` block with gradient, causing duplicate IDs and potential rendering issues.
**Fix:** Move defs to a single location (ReactFlow component or separate component).

### 8. **Metrics Calculated on Filtered Graph**
**Location:** `src/components/lineage/LineageView.tsx:172`
**Issue:** Metrics are calculated before filtering, but should reflect filtered view for accurate display.
**Fix:** Recalculate metrics after filtering or show both filtered and total metrics.

### 9. **Race Condition in API Calls**
**Location:** `src/components/lineage/LineageView.tsx:97-179`
**Issue:** Rapid config changes can trigger multiple simultaneous API calls, causing race conditions.
**Fix:** Add request cancellation or debouncing.

### 10. **Empty Lineage Response Handling**
**Location:** `src/components/lineage/LineageView.tsx:115`
**Issue:** No handling for empty `guidEntityMap` or `relations` arrays.
**Fix:** Add validation and show appropriate empty state.

## Minor Issues

### 11. **Missing URL Param Handling**
**Location:** `src/components/lineage/LineageView.tsx:78-94`
**Issue:** Component doesn't read `guid` from URL params, only relies on asset store.
**Fix:** Add URL param reading in LineageView.

### 12. **CSS Layout Issues**
**Location:** `src/pages/LineageViewPage.css`
**Issue:** User added margin-left adjustments but CSS structure might conflict with flex layout.
**Fix:** Ensure proper flex container setup.

### 13. **Node Position Not Preserved on Filter**
**Location:** `src/components/lineage/LineageView.tsx:293-299`
**Issue:** When filtering, node positions might be lost if nodes are recreated.
**Fix:** Preserve positions from original graph.

### 14. **Impact Analysis Doesn't Clear on Mode Toggle**
**Location:** `src/components/lineage/LineageView.tsx:189-232`
**Issue:** When toggling analysis modes off, highlights might not clear properly.
**Fix:** Ensure cleanup in else branch.

### 15. **Missing Loading State During Scoring**
**Location:** `src/components/lineage/LineageView.tsx:118-148`
**Issue:** Quality score fetching happens after lineage fetch but doesn't show loading state.
**Fix:** Add loading indicator for scoring phase.







