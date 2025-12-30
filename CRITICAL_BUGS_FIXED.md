# Critical Bugs Found and Fixed

## 🔴 CRITICAL BUG #1: Edge Direction Logic is Fundamentally Broken

**Location:** `src/utils/lineageGraph.ts:143-177`

**Problem:** The `isUpstream` flag only checks if an edge directly connects to the center node. In a lineage graph with transitive relationships (A -> B -> Center), the edge A->B is part of the upstream path but won't be marked correctly.

**Impact:** 
- Impact analysis won't find all affected nodes
- Root cause analysis won't trace all upstream paths
- Edge filtering by direction will exclude valid edges
- Node lineage flags will be incorrect

**Fix:** Need to traverse the graph to determine if edges are part of upstream/downstream paths, not just check direct connections.

## 🔴 CRITICAL BUG #2: Node Lineage Flags Only Check Direct Connections

**Location:** `src/utils/lineageGraph.ts:147-155`

**Problem:** `hasUpstream`/`hasDownstream` flags are only set for nodes directly connected to center. Nodes that are upstream/downstream transitively won't have correct flags.

**Impact:**
- Coverage metrics will be wrong
- Node badges showing upstream/downstream counts will be incorrect
- Filtering by orphaned assets will miss nodes

**Fix:** After building all edges, traverse graph to set flags for all nodes based on reachability.

## 🔴 CRITICAL BUG #3: findImpactPath Uses Wrong Edge Filter

**Location:** `src/utils/lineageGraph.ts:316`

**Problem:** Filters edges with `!e.isUpstream`, but `isUpstream` flag is wrong (only checks direct center connection). Should traverse based on edge direction (source->target).

**Impact:** Impact analysis will miss many affected nodes.

**Fix:** Traverse based on edge direction, not the isUpstream flag.

## 🔴 CRITICAL BUG #4: findRootCausePath Uses Wrong Edge Filter

**Location:** `src/utils/lineageGraph.ts:340`

**Problem:** Same as #3 - filters by `e.isUpstream` which is incorrect.

**Impact:** Root cause analysis won't find all upstream sources.

## 🟡 BUG #5: Center Asset May Not Be in guidEntityMap

**Location:** `src/utils/lineageGraph.ts:105-106`

**Problem:** Center asset might not be in API response's guidEntityMap. We create it manually, but if it IS in the map, we skip it and might miss updated data.

**Impact:** Center node might have stale data if API returns updated version.

## 🟡 BUG #6: Quality Scores Not Fetched for Center Asset

**Location:** `src/components/lineage/LineageView.tsx:137-144`

**Problem:** We filter assets from `guidEntityMap` for scoring, but center asset is created separately and might not be in that map, so it won't get scored.

**Impact:** Center node won't show quality scores.

## 🟡 BUG #7: AbortController Dependency Causes Unnecessary Re-renders

**Location:** `src/components/lineage/LineageView.tsx:212`

**Problem:** `abortController` is in dependency array, but it changes every fetch, causing callback to be recreated.

**Impact:** Performance issues, potential infinite loops.

## 🟡 BUG #8: Edge Filtering Logic is Incomplete

**Location:** `src/utils/lineageGraph.ts:169-176`

**Problem:** When direction is 'upstream' or 'downstream', we filter edges, but the `isUpstream` flag is wrong, so we might include/exclude wrong edges.

**Impact:** Wrong edges shown when filtering by direction.

## 🟡 BUG #9: Missing Validation for Center Asset in Response

**Location:** `src/components/lineage/LineageView.tsx:131-134`

**Problem:** We check if guidEntityMap is empty, but don't verify center asset exists or handle case where it's missing.

**Impact:** Could show empty graph even when center asset should be visible.

## 🟡 BUG #10: Node Position Not Preserved When Filtering

**Location:** `src/components/lineage/LineageView.tsx:296-299`

**Problem:** When filtering nodes, we create new React Flow nodes. If positions were set by layout, they should be preserved, but we're using `node.position || { x: 0, y: 0 }` which might lose positions.

**Impact:** Graph layout might reset when filtering.

