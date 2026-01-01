# Header-Based Asset Browser - Implementation Plan

## Current State

- **Left Sidebar**: Asset browser takes 320px (collapsible to 48px)
- **Total Left Margin**: 560px (240px nav + 320px browser)
- **Components**: AssetBrowser.tsx, AssetContext.tsx, PersistentAssetBrowser.tsx, AppHeader.tsx
- **State**: assetStore (selection), assetContextStore (context)

## Goals

1. Free up horizontal space for main content
2. Keep asset browsing accessible but not always visible
3. Maintain drag-drop functionality for context setting
4. Clean up duplicate header/context components

---

## Option 2: Expandable Panel (Recommended)

### Concept
Header contains a compact context bar. Clicking expands a full-width panel that drops down with the asset tree browser.

### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ [≡] MQ  │  🔗 Connected │  📦 Schema: sales (42 assets) [▼]    │
├─────────────────────────────────────────────────────────────────┤
│                     EXPANDED PANEL (when open)                   │
│  ┌─────────────────┬────────────────────────────────────────┐   │
│  │ Asset Browser   │  Selected Context                       │   │
│  │ (Tree View)     │  - Drop zone                           │   │
│  │                 │  - Asset list                          │   │
│  │ [Connectors]    │  - Quick actions                       │   │
│  │  └─ Databases   │                                        │   │
│  │     └─ Schemas  │  [Apply Context] [Clear]               │   │
│  │        └─ Tables│                                        │   │
│  └─────────────────┴────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                        MAIN CONTENT                              │
│                   (Full width when panel closed)                 │
└─────────────────────────────────────────────────────────────────┘
```

### Components

1. **HeaderAssetBar** (new)
   - Shows current context summary
   - Toggle button to expand/collapse panel
   - Quick stats (asset count, connection status)

2. **AssetBrowserPanel** (new)
   - Full-width dropdown panel
   - Contains existing AssetBrowser tree
   - Side-by-side: Tree | Context drop zone
   - Animated slide-down

3. **AppHeader** (modify)
   - Integrate HeaderAssetBar
   - Remove separate AssetContext

### State Changes
- Add `isPanelOpen` state to control expansion
- Keep existing assetContextStore
- Remove need for PersistentAssetBrowser wrapper

### CSS Changes
- Remove left margin from pages (no more 560px offset)
- Panel uses `position: absolute` or pushes content down
- Smooth height transition

---

## Option 3: Search-First Approach

### Concept
Minimal header with search input and recent assets. Full browser opens in modal when needed.

### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ [≡] MQ │ [🔍 Search assets...    ] │ Recent: [A][B][C] │ [⚙]   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (on search focus or click)
                    ┌─────────────────────┐
                    │  Search Results     │
                    │  ───────────────    │
                    │  📊 sales_orders    │
                    │  📊 customers       │
                    │  📊 products        │
                    │  ───────────────    │
                    │  [Browse All →]     │
                    └─────────────────────┘
                              │
                              ▼ (Browse All or keyboard shortcut)
┌─────────────────────────────────────────────────────────────────┐
│                      MODAL: Asset Browser                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ [🔍 Filter...]                                    [×]       ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Connectors          │  Selected (3 assets)                  ││
│  │  └─ snowflake       │  ┌──────────────────────────────────┐ ││
│  │     └─ ANALYTICS    │  │ 📊 sales_orders                  │ ││
│  │        └─ SALES     │  │ 📊 customers                     │ ││
│  │           └─ tables │  │ 📊 products                      │ ││
│  │                     │  └──────────────────────────────────┘ ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │                    [Set as Context] [Cancel]                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Components

1. **HeaderSearchBar** (new)
   - Search input with autocomplete
   - Dropdown with recent assets
   - Quick select from suggestions

2. **AssetSearchDropdown** (new)
   - Shows search results
   - Keyboard navigation
   - "Browse All" link to modal

3. **AssetBrowserModal** (new)
   - Full browser in modal
   - Reuses existing AssetBrowser tree
   - Selection → Set Context action

4. **RecentAssets** (new)
   - Small chips showing recent selections
   - Click to restore context
   - Stored in localStorage

### State Changes
- Add `searchQuery` state
- Add `recentContexts` to assetContextStore
- Add modal open/close state

### New API Needs
- Asset search endpoint (or client-side filtering)
- Recent assets persistence

---

## Comparison

| Feature | Option 2 (Panel) | Option 3 (Search) |
|---------|------------------|-------------------|
| Discovery | Good (tree visible) | Requires knowing what to search |
| Space Usage | Panel pushes content | Minimal, modal overlay |
| Drag-Drop | Natural in panel | In modal only |
| Quick Access | One click to expand | Search or click recent |
| Implementation | Medium complexity | Higher complexity |
| Mobile-friendly | Less (panel may be tall) | More (modal is standard) |

---

## Recommended: Hybrid Approach

Combine best of both:

1. **Header Bar** with:
   - Context summary + expand button
   - Search input (inline, not modal)
   - Recent assets chips

2. **Expandable Panel** for:
   - Full tree browsing
   - Drag-drop context setting
   - Bulk selection

3. **Search Dropdown** for:
   - Quick asset lookup
   - Keyboard-first workflow

---

## Implementation Phases

### Phase 1: Core Header Integration
- [ ] Create HeaderAssetBar component
- [ ] Move context display to header
- [ ] Remove PersistentAssetBrowser from sidebar
- [ ] Update page CSS (remove 320px margin)

### Phase 2: Expandable Panel
- [ ] Create AssetBrowserPanel component
- [ ] Animate panel expansion
- [ ] Wire up existing AssetBrowser
- [ ] Add drop zone in panel

### Phase 3: Search Enhancement
- [ ] Add search input to header
- [ ] Create search dropdown
- [ ] Implement client-side search
- [ ] Add recent assets feature

### Phase 4: Cleanup
- [ ] Remove duplicate components
- [ ] Consolidate CSS
- [ ] Update all page layouts
- [ ] Test responsive behavior

---

## Files to Create/Modify

### New Files
- `src/components/layout/HeaderAssetBar.tsx`
- `src/components/layout/HeaderAssetBar.css`
- `src/components/layout/AssetBrowserPanel.tsx`
- `src/components/layout/AssetBrowserPanel.css`

### Modify
- `src/components/layout/AppHeader.tsx` - integrate new components
- `src/App.tsx` - remove PersistentAssetBrowser
- `src/App.css` - update margins
- `src/pages/*.css` - remove left margins
- `src/components/dashboard/ExecutiveDashboard.css`
- `src/pages/PivotBuilder.css`
- `src/pages/LineageViewPage.css`

### Potentially Remove
- `src/components/AssetBrowser/PersistentAssetBrowser.tsx`
- `src/components/AssetBrowser/PersistentAssetBrowser.css`
- `src/components/AssetContext.tsx` (merge into header)
- `src/components/AssetContext.css`
