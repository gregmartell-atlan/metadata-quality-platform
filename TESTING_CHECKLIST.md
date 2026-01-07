# Testing Checklist - Items 1-4

## Item 1: Connect Button Moved Right ✅

**Expected**: Connect button should be on right side of header, not left

**Test**:
- Navigate to http://localhost:5175/pivot
- Check header layout
- Connect button should be after page title and actions

**Visual Check**: Look at header - should see:
```
[Context Bar] | [Title] | [Actions] [Connected]
```

---

## Item 2: Hover Expansion on Context Dropdowns ✅

**Expected**: Dropdowns expand from 420px to 480px on hover

**Test**:
1. Click "Connection" dropdown
2. Hover over dropdown panel
3. Should see width increase and shadow lift

**CSS Check**:
```css
.breadcrumb-dropdown {
  min-width: 420px;
  transition: min-width 200ms ease;
}

.breadcrumb-dropdown:hover {
  min-width: 480px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
}
```

---

## Item 3: Entity Inspector (Info Icons) ✅

**Expected**: Hover over database/schema rows shows Info icon, click to open inspector

**Test**:
1. Click "snowflake" in context bar
2. Click "Database" dropdown
3. Hover over any database row
4. Info icon should fade in on right side
5. Click info icon
6. AssetInspectorModal should open with full metadata

**Implementation Check**:
- Info icon opacity: 0 (default)
- On hover: opacity: 1
- Click handler calls `openInspector(entity)`
- Full entity stored from getDatabases/getSchemas response

---

## Item 4: Light Sidebar Theme ✅

**Expected**: Sidebar uses light background, not dark navy

**Visual Check**: Sidebar should be:
- Background: white (#ffffff)
- Text: slate gray (not white)
- Border: subtle gray (not dark)
- Active state: blue background

**CSS Tokens**:
```css
--sidebar-bg: var(--bg-surface); /* white */
--sidebar-text: var(--text-secondary); /* gray-600 */
--sidebar-item-hover: var(--bg-hover); /* gray-100 */
--sidebar-item-active-bg: var(--bg-selected); /* blue-50 */
```

**Pattern**: Matches Supabase/Linear (light sidebar with border)

---

## Additional Items to Verify

### Design Principles:
- [ ] Cards have borders only (no shadows)
- [ ] Sharp 8px corners maximum
- [ ] "FILTERED" badge shows when context active
- [ ] 4px grid spacing throughout

### Snowflake Issue:
- [ ] Click Connection dropdown
- [ ] Select "snowflake"
- [ ] Click Database dropdown
- [ ] Should show ALL databases (not empty or stuck loading)
- [ ] Should include: WIDE_WORLD_IMPORTERS, MDLH, AI databases

### Context Persistence:
- [ ] Select context on Pivot page
- [ ] Navigate to DaaP Analytics
- [ ] Context should persist
- [ ] "FILTERED" badge still shows

---

## Console Checks

Current console shows:
✅ `getDatabases called {"input":"snowflake","normalized":"snowflake"}`
⚠️ Some empty error objects (msgid 9-12) - need to investigate

---

## Ready to Test

All code is committed and dev server is running. The browser should show all 8 commits worth of changes after hard refresh.
