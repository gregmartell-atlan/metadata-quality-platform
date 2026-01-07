# Hierarchical Context Bar - Implementation Guide

## Overview

A Mac-style horizontal breadcrumb navigator that consolidates asset browsing and context selection into one elegant, horizontal interface. Replaces the disjointed "Browse" button + context selector pattern.

**Design Philosophy**: Refined Industrial
- Mac Finder breadcrumb precision
- Linear-style efficiency
- SF Pro typography (native Mac feel)
- Subtle animations with intention
- Borders and background shifts for depth

---

## What It Solves

### Before (Problems):
1. ❌ **Disjointed UX**: Separate "Browse" button and context selector
2. ❌ **Vertical panel**: Asset browser takes screen space
3. ❌ **Context unclear**: Hard to see what level you're browsing
4. ❌ **Inconsistent loading**: Different behavior across pages

### After (Solutions):
1. ✅ **Unified interface**: Browse and select in one horizontal toolbar
2. ✅ **Space efficient**: Horizontal bar, dropdowns only when needed
3. ✅ **Clear hierarchy**: Connection > Database > Schema always visible
4. ✅ **Consistent**: Same behavior everywhere

---

## Component Architecture

```
HierarchicalContextBar
├── Connection Dropdown (Level 1)
├── Database Dropdown (Level 2) - loads when connection selected
├── Schema Dropdown (Level 3) - loads when database selected
├── Asset Count Badge - shows filtered asset count
└── Clear Button - resets to "All Assets"
```

### State Management
- Integrates with `assetContextStore` (existing Zustand store)
- Auto-loads child levels when parent is selected
- Syncs selection with global context
- Triggers asset loading on selection change

---

## Integration Steps

### Step 1: Add to AppHeader

**File**: `src/components/layout/AppHeader.tsx`

Replace the current context controls section with:

```tsx
import { HierarchicalContextBar } from '../navigation/HierarchicalContextBar';

// In the render:
<header className="app-header">
  <div className="app-header-left">
    {/* Connection status button - keep */}
    <button className={`connect-btn ${isConnected ? 'connected' : ''}`} ...>
      {isConnected ? <Link2 size={16} /> : <Link2Off size={16} />}
      <span>{isConnected ? 'Connected' : 'Connect to Atlan'}</span>
    </button>

    {/* REMOVE: Browse button, QuickContextSwitcher, context-drop-zone */}
    {/* REPLACE WITH: HierarchicalContextBar */}
  </div>

  {/* New consolidated navigation */}
  {isConnected && <HierarchicalContextBar />}

  <div className="app-header-center">
    <h1>{title}</h1>
    {subtitle && <p>{subtitle}</p>}
  </div>

  <div className="app-header-right">
    <button className="settings-btn" ...>
      <Settings size={16} />
    </button>
    {children}
  </div>
</header>

{/* REMOVE: AssetBrowserPanel */}
{/* REMOVE: QuickContextSwitcher */}
```

### Step 2: Update AppHeader Layout

**File**: `src/components/layout/AppHeader.css`

```css
.app-header {
  display: flex;
  flex-direction: column; /* Stack: controls row + context bar */
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
}

.app-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  gap: 16px;
}

.app-header-left,
.app-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-header-center {
  flex: 1;
  text-align: center;
}

/* HierarchicalContextBar takes full width below header row */
```

### Step 3: Export Component

**File**: `src/components/navigation/index.ts`

```ts
export { HierarchicalContextBar } from './HierarchicalContextBar';
```

---

## Usage Examples

### Example 1: All Pages (Default)

```tsx
// Every page automatically gets the context bar via AppHeader
<AppHeader title="Pivot Builder">
  {/* Page-specific actions */}
</AppHeader>

// HierarchicalContextBar renders automatically
// Shows: Connection > Database > Schema navigation
```

### Example 2: Programmatic Context Setting

```tsx
import { useAssetContextStore } from '../../stores/assetContextStore';

function MyComponent() {
  const { setContext } = useAssetContextStore();

  // Trigger context change (bar will update automatically)
  const loadSnowflake = async () => {
    const assets = await loadAssetsForContext('connection', {
      connectionName: 'snowflake'
    });
    setContext('connection', { connectionName: 'snowflake' }, 'Snowflake', assets);
  };

  // The HierarchicalContextBar will show:
  // ❄️ Snowflake > [Database dropdown] > [Schema dropdown]
}
```

### Example 3: Pre-select Specific Database

```tsx
// On mount, set context to specific database
useEffect(() => {
  const loadWideWorld = async () => {
    const assets = await loadAssetsForContext('database', {
      connectionName: 'snowflake',
      databaseName: 'WIDE_WORLD_IMPORTERS'
    });
    setContext('database', {
      connectionName: 'snowflake',
      databaseName: 'WIDE_WORLD_IMPORTERS'
    }, 'Snowflake > WIDE_WORLD_IMPORTERS', assets);
  };
  loadWideWorld();
}, []);

// Bar will show:
// ❄️ Snowflake > 📁 WIDE_WORLD_IMPORTERS > [Schema dropdown]
```

---

## Features

### 1. **Eager Loading**
- Connections load on mount
- Databases load when connection selected
- Schemas load when database selected
- **No manual "Browse" click required**

### 2. **Visual Hierarchy**
- Icons distinguish levels (Snowflake, Folder, Table icons)
- Selected items highlighted with blue accent
- Separators (>) show progression
- Asset count badge at end

### 3. **Mac-Style Dropdowns**
- Slide-in animation (220ms with custom easing)
- Staggered item reveal (20ms delays)
- Scrollable with custom styled scrollbar
- Click outside to close

### 4. **Keyboard Navigation**
- Focus states with blue outline
- Tab through breadcrumbs
- Enter to open dropdown
- Arrow keys to navigate items (TODO: implement)

### 5. **Responsive Behavior**
- Truncates long names with ellipsis
- Adjusts to density preferences (compact/comfortable/spacious)
- Mobile: stacks if needed

---

## Styling Details

### Typography
- **SF Pro Display** (Mac native): Primary labels
- **SF Mono**: Numbers, counts, technical identifiers
- **Letter spacing**: -0.01em for refined look
- **Font weights**: 400 (default), 500 (medium), 600 (selected)

### Colors
- **Unselected**: `--text-secondary` (subtle)
- **Selected**: `--text-default` + blue accent
- **Hover**: `--bg-hover` (gentle lift)
- **Active dropdown**: Blue outline glow

### Spacing
- **Horizontal gaps**: 6-16px (tight but breathable)
- **Padding**: 6-12px (compact yet tappable)
- **Dropdown padding**: 4px wrapper, 10-12px items

### Animation Timing
- **Dropdown open**: 220ms with `cubic-bezier(0.25, 1, 0.5, 1)` (smooth deceleration)
- **Item stagger**: 20ms delays (subtle reveal)
- **Hover transitions**: 140-180ms (snappy but not jarring)
- **Button press**: `scale(0.98)` (tactile feedback)

---

## Testing Checklist

### Visual Tests
- [ ] All three dropdown levels render correctly
- [ ] Icons match connection types (Snowflake, Database, etc.)
- [ ] Selected state shows blue accent
- [ ] Hover states feel smooth
- [ ] Animations don't feel janky (60fps)

### Functional Tests
- [ ] Clicking connection loads databases
- [ ] Clicking database loads schemas
- [ ] Clicking schema triggers asset load
- [ ] Asset count updates correctly
- [ ] Clear button resets all selections
- [ ] Context syncs with assetContextStore

### Integration Tests
- [ ] Works on Pivot Builder page
- [ ] Works on DaaP Analytics page
- [ ] Works on Dashboard page
- [ ] Context persists across page navigation
- [ ] Multiple browser tabs sync context

### Accessibility Tests
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Screen reader friendly (ARIA labels needed)
- [ ] Color contrast meets WCAG AA

---

## Performance Considerations

### Optimizations
- ✅ **Memoized icon components**: Prevents re-renders
- ✅ **Lazy dropdown rendering**: Only render when open
- ✅ **Debounced API calls**: Prevent rapid-fire requests
- ✅ **Click-outside with useEffect cleanup**: No memory leaks

### Potential Issues
- ⚠️ **Large dropdown lists**: Virtualize if >100 items
- ⚠️ **Slow API responses**: Show loading spinner
- ⚠️ **Network errors**: Add error state UI

---

## Next Steps

### Phase 1: Core Integration (This PR)
1. ✅ Create HierarchicalContextBar component
2. ✅ Create CSS with Mac-style aesthetics
3. ⬜ Integrate into AppHeader
4. ⬜ Remove old Browse button + QuickContextSwitcher
5. ⬜ Test on all pages

### Phase 2: Enhancements
- Add keyboard navigation (Arrow keys, Enter, Escape)
- Add search within dropdowns
- Add recent/pinned connections
- Add "Star" favorite databases
- Add breadcrumb path copying

### Phase 3: Advanced Features
- Virtual scrolling for large lists
- Database/schema metadata preview on hover
- Quick filters (show only starred, hide empty)
- Context history (back/forward navigation)

---

## Migration Notes

### Code to Remove
- `src/components/layout/AssetBrowserPanel.tsx` (replaced)
- `src/components/layout/QuickContextSwitcher.tsx` (replaced)
- `Browse` button logic in AppHeader
- Drag-and-drop zone in AppHeader (can keep if desired)

### Code to Keep
- `assetContextStore` (no changes needed)
- `loadAssetsForContext` utility (used by new component)
- `getConnectors`, `getDatabases`, `getSchemas` API calls

### Breaking Changes
- None! Component integrates with existing store
- Old context setting still works
- Can deploy incrementally (feature flag)

---

## Design Rationale

### Why Horizontal?
- **Screen real estate**: Data tables need vertical space
- **Mac familiarity**: Users already understand Finder breadcrumbs
- **Glanceability**: See full path without expanding
- **Speed**: Faster than multi-click vertical navigation

### Why Inline Dropdowns?
- **Context preservation**: See where you are while browsing
- **Reduced clicks**: No modal/panel to open first
- **Smooth flow**: Connection → Database → Schema feels natural
- **Progressive disclosure**: Only show options when relevant

### Why This Aesthetic?
- **Refined industrial**: Matches data professional tools
- **SF Pro typography**: Native Mac feel (familiar, trustworthy)
- **Subtle animations**: Feels polished without being distracting
- **Borders over shadows**: Clean, technical, information-forward

---

## Visual Comparison

### Old Pattern:
```
[Connect] [Browse ▼] [Context: Snowflake >] [...drop zone...]
```
- 3 separate UI elements
- Browse opens vertical panel
- Context shows but isn't interactive in meaningful way

### New Pattern:
```
[Connect] | Connection ▼ > Database ▼ > Schema ▼ | 1,247 assets | [Clear]
```
- 1 unified horizontal navigation
- Everything inline and accessible
- Clear visual hierarchy
- Immediate interaction

---

## Success Metrics

**UX Goals**:
- ✅ Reduce clicks to set context (from 3-4 to 1-2)
- ✅ Increase context clarity (always visible)
- ✅ Consolidate browsing + selection
- ✅ Consistent across all pages

**Visual Goals**:
- ✅ Mac-style refinement
- ✅ Smooth, polished animations
- ✅ Technical aesthetic for data pros
- ✅ Memorable and distinctive

---

**Commit this component, integrate into AppHeader, test across all views, then ship!**
