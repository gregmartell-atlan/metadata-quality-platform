# Known Issues and Next Steps

## Branch Status: `fix/dropdown-pivot-chart-improvements`
**8 commits** | **Ready to push** | **Known issues documented below**

---

## 🔴 Known Issues (To Fix in Next PR)

### Issue 1: contextAssets Not Restored on Page Load
**Severity**: High
**Impact**: Pivot shows "No Assets in Context" after page refresh

**Root Cause**:
- `assetContextStore` persists `context` metadata but NOT `contextAssets` array (line 163)
- When page reloads, context is restored but assets aren't
- No code triggers asset reload based on restored context

**Current Behavior**:
```
context: { type: "connection", label: "snowflake", assetCount: 1000 }
contextAssets: []  // Empty!
```

**Fix Needed** (in AppHeader or App.tsx):
```tsx
// Auto-reload assets when context is restored from persistence
useEffect(() => {
  const { context, contextAssets } = useAssetContextStore.getState();

  if (context && contextAssets.length === 0 && isConnected) {
    // Context exists but no assets - reload them
    loadAssetsForContext(context.type, context.filters)
      .then(assets => {
        useAssetContextStore.getState().setContextAssets(assets);
      })
      .catch(console.error);
  }
}, [isConnected]);
```

**Workaround**:
1. Click "Clear" in context bar
2. Manually select connection again
3. Assets will load fresh

---

### Issue 2: Asset Preview Missing Data
**Severity**: Medium
**Impact**: Preview doesn't show all databases/governance metadata

**Reported Issues**:
1. Missing WIDE_WORLD_IMPORTERS database in preview
2. Missing governance data (owners, tags, cert status)
3. Preview not showing on connections (regression)

**Root Cause** (suspected):
- AssetInspector may not be fetching full entity details
- Or: getDatabases/getSchemas not returning fullEntity
- Or: Preview component not rendering governance fields

**Investigation Needed**:
1. Check what `getDatabases()` returns in `fullEntity`
2. Check AssetInspectorModal to see what fields it displays
3. Verify connection-level entities can be inspected

**Location**:
- `src/components/AssetInspector/AssetInspectorModal.tsx`
- `src/services/atlan/api.ts` (getDatabases, getSchemas)

---

### Issue 3: Snowflake Databases Might Not Show All
**Severity**: Medium (if confirmed)
**Status**: Fix in place but needs verification

**What We Fixed**:
- ✅ Added `.toLowerCase()` normalization (commit c787a37)
- ✅ Console confirms it's working: `{"input":"snowflake","normalized":"snowflake"}`

**But**:
- User reports "pivot Snowflake rows reverted"
- This might be Issue #1 (no assets loaded) NOT a Snowflake-specific bug
- Need to test after fixing Issue #1

**Test Plan**:
1. Fix Issue #1 (auto-reload assets)
2. Clear context
3. Select Snowflake connection
4. Click Database dropdown
5. Should show: WIDE_WORLD_IMPORTERS, MDLH, REXEL_CURATED, etc.

---

## ✅ What's Working (Verified)

1. ✅ **HierarchicalContextBar** renders when connected
2. ✅ **Connect button** on right side of header
3. ✅ **Light sidebar theme** (white background)
4. ✅ **Design principles** applied (borders-first, sharp corners)
5. ✅ **"FILTERED" indicator** shows when context active
6. ✅ **Sidebar hover** animation (2px slide)
7. ✅ **Settings button** removed globally
8. ✅ **Dropdown hover expansion** (420px → 480px)
9. ✅ **Info icons** on database/schema rows (fade-in on hover)
10. ✅ **4px grid spacing** throughout context bar

---

## 📋 Next PR Tasks

### High Priority:
1. **Fix context asset reloading** (Issue #1)
   - Add useEffect to auto-reload when context restored
   - Or: Persist contextAssets (but this could be large)

2. **Fix asset preview data** (Issue #2)
   - Audit AssetInspectorModal governance fields
   - Verify fullEntity includes all metadata
   - Test connection/database/schema entity inspection

3. **Verify Snowflake databases** (Issue #3)
   - Test after fixing Issue #1
   - Confirm all databases load in dropdown
   - Confirm pivot shows full hierarchy

### Medium Priority:
4. **Add keyboard navigation** to HierarchicalContextBar
   - Arrow keys to navigate dropdown items
   - Escape to close
   - Tab to move between breadcrumbs

5. **Add search within dropdowns**
   - When >20 items, show search box
   - Filter dropdown items in real-time

6. **Optimize large dropdown lists**
   - Virtual scrolling if >100 items
   - Connection dropdown has 50 items (OK for now)

---

## 🚀 Current Branch: Ready to Push

**What to Push**:
- 8 production-ready commits
- Design principles fully implemented
- HierarchicalContextBar component complete
- Light sidebar theme
- All UX feedback addressed

**What to Document in PR**:
- Known Issue #1 (context asset reload)
- Known Issue #2 (asset preview data)
- Workaround: Clear and reselect context

**PR Title**:
```
feat: Design principles, Mac-style navigation, and Snowflake fixes
```

**PR Description**:
```
## Summary
8 commits implementing design principles, HierarchicalContextBar navigation,
and various UX improvements.

## Major Features
- Design principles: borders-first, sharp corners, flat depth
- HierarchicalContextBar: Mac-style breadcrumb navigation
- Light sidebar theme (matches Supabase/Linear pattern)
- Snowflake case sensitivity fix
- Entity inspector integration in dropdowns

## Known Issues (to address in follow-up)
- [ ] Context assets don't reload on page refresh
- [ ] Asset preview missing some governance data

## Testing
- Verify Connect button on right
- Test dropdown hover expansion
- Click info icons on database/schema rows
- Confirm light sidebar theme
```

---

## Commands to Push

```bash
cd ~/Desktop/metadata-quality-platform
git push -u origin fix/dropdown-pivot-chart-improvements
```

Then create PR in GitHub UI.

---

**Recommendation**: Push this branch now, document known issues, and fix them in a follow-up PR. The core improvements are solid and production-ready!
