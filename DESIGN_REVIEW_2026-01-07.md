# Design Principles Review - Metadata Quality Platform
**Date**: January 7, 2026
**Branch**: fix/dropdown-pivot-chart-improvements
**Reviewer**: Claude Code (design-principles skill)

---

## Product Context

**What it does**: Metadata quality analysis platform with pivot tables, lineage exploration, and governance dashboards
**Who uses it**: Data governance teams, stewards, data analysts (power users who live in the tool)
**Emotional job**: Trust + Efficiency + Data Insight

**Recommended Design Direction**: **"Data & Analysis"** blended with **"Precision & Density"**
- Chart-optimized, technical but accessible
- Numbers and metrics as first-class citizens
- Information-forward with functional density
- Cool neutral foundation (current slate palette ✅)
- Blue accent for trust signals (current #3366FF ✅)

---

## ✅ What's Already Strong

### 1. Token System Foundation
- ✅ Comprehensive semantic tokens (`--bg-canvas`, `--text-default`, `--border-subtle`)
- ✅ Well-defined slate/gray scale (50-900)
- ✅ Purpose-built heatmap color system for data visualization
- ✅ Proper 4px spacing grid (4, 8, 12, 16, 24, 32)
- ✅ Semantic state colors (success, warning, danger, info)

### 2. Dark Sidebar Pattern
- ✅ Dark navy sidebar (`#0d1b2a`) with white content area
- ✅ Strong visual hierarchy separating navigation from content
- ✅ Appropriate for data-dense product (like Linear, Supabase)

### 3. Typography
- ✅ Inter font (geometric, technical, enterprise-appropriate)
- ✅ Proper weight scale (400, 500, 600, 700)
- ✅ Monospace for data (codes, IDs, numbers)

### 4. Component Architecture
- ✅ Shared component library (`src/components/shared/`)
- ✅ Semantic token usage (not hardcoded colors)
- ✅ Lazy loading for performance

---

## 🚨 Critical Issues (Fix These First)

### 1. **Inconsistent Depth Strategy** (Priority 1)

**Problem**: Mixing borders + layered shadows creates visual confusion

**Current state**:
```css
/* index.css line 740 */
.card {
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow-card);  /* ← Redundant with border */
}

/* index.css line 772 */
.query-card:hover {
  border-color: var(--primary-blue);
  box-shadow: var(--shadow-md);  /* ← Heavy shadow on hover */
}

/* index.css line 778 */
.hero-card {
  background: linear-gradient(...);  /* ← Decorative gradient */
  border-radius: var(--radius-xl);   /* ← 12px, too round */
}
```

**Recommendation**: **Borders-first approach** for data platform
```css
.card {
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  /* NO shadow - borders define regions */
}

.card:hover {
  border-color: var(--border-focus); /* Blue hint */
}

.hero-card {
  background: var(--color-blue-50);  /* Solid, not gradient */
  border: 1px solid var(--color-blue-200);
  border-radius: var(--radius-lg);   /* 8px, not 12px */
}
```

### 2. **Too Many Shadow Variants** (Priority 1)

**Problem**: 6 shadow levels (xs, sm, md, lg, xl, card) + legacy aliases

**Current** (`src/index.css:328-333`):
```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
--shadow-card: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
```

**Recommendation**: Simplify to minimal shadows
```css
/* For data platform: borders do the work */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);  /* Only for modals/overlays */

/* Remove: md, lg, xl, card variants */
```

### 3. **Border Radius System Inconsistency** (Priority 1)

**Problem**: Too many radius values (4px, 6px, 8px, **12px**, **16px**)

**Current** (`src/index.css:318-323`):
```css
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-xl: 12px;   /* ← Remove */
--radius-2xl: 16px;  /* ← Remove */
--radius-full: 9999px;
```

**Usage issues**:
- `.hero-card` uses 12px (`radius-xl`) - too round for technical product
- Inconsistent - some cards use 8px, some use 12px

**Recommendation**: **Sharp technical system** (4px, 6px, 8px max)
```css
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-full: 9999px;  /* Pills/badges only */

/* Remove: radius-xl (12px), radius-2xl (16px) */
```

### 4. **Inline Styles Anti-Pattern** (Priority 2)

**Problem**: Mixing inline styles defeats the design system

**Example** (`PivotBuilder.tsx:75`):
```tsx
<Button
  variant="secondary"
  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}  /* ← BAD */
>
```

**Fix**: These styles should be in Button.css or use className
```tsx
<Button variant="secondary" className="btn-with-icon">
```

### 5. **Native Form Elements** (Priority 2)

**Problem**: Native `<select>` in PivotBuilder.tsx line 52-69

Native selects:
- Can't be fully styled
- Don't match design system
- Inconsistent cross-browser rendering

**Current** (`PivotBuilder.tsx:52`):
```tsx
<select value={currentView?.id || ''} className="view-select">
  <option value="">No view loaded</option>
  {views.map((view) => (
    <option key={view.id} value={view.id}>{view.name}</option>
  ))}
</select>
```

**Recommendation**: Build custom dropdown component
```tsx
// Custom dropdown with styled trigger button + popover menu
<Dropdown value={currentView?.id} onChange={handleLoadView}>
  <DropdownTrigger>
    <span>{currentView?.name || 'No view loaded'}</span>
    <ChevronDown size={16} />
  </DropdownTrigger>
  <DropdownMenu>
    {views.map((view) => (
      <DropdownItem key={view.id} value={view.id}>
        {view.name}
      </DropdownItem>
    ))}
  </DropdownMenu>
</Dropdown>
```

### 6. **Decorative Gradient** (Priority 2)

**Problem**: Hero card uses gradient for decoration, not meaning

**Current** (`index.css:778`):
```css
.hero-card {
  background: linear-gradient(135deg, var(--primary-blue-light) 0%, var(--card-bg) 100%);
  border-radius: var(--radius-xl);  /* Also too round */
}
```

**Fix**:
```css
.hero-card {
  background: var(--color-blue-50);  /* Solid tint */
  border: 1px solid var(--color-blue-200);
  border-radius: var(--radius-lg);  /* 8px max */
}
```

---

## 🎨 Design Direction Recommendations

### Commit to: **"Data & Analysis" + "Precision & Density"**

#### Visual Characteristics:
- **Depth**: Borders-only (flat, technical)
- **Corners**: Sharp system (4px, 6px, 8px)
- **Density**: Comfortable (current spacing works)
- **Color**: Monochrome structure, blue for functional meaning
- **Charts**: Heatmaps, pivot tables front-and-center
- **Typography**: Tabular nums, mono for data

#### What This Means in Practice:

**Cards**: All use same surface treatment
```css
.card, .query-card, .stat-card, .metric-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);  /* 8px */
  /* NO box-shadow */
}

.card:hover {
  border-color: var(--border-focus);  /* Blue hint */
}
```

**Data Tables**: Maximum density, minimal chrome
- Compact row height
- Subtle borders
- Monospace numbers
- No shadows

**Pivot Tables**: Purpose-built for scanning
- Heatmap colors (keep current scale ✅)
- Clear hierarchy through typography weight
- No decorative elements

**Dashboards**: Information density over decoration
- Tight metric cards
- Minimal spacing between related data
- Color only for status/alerts

---

## 📐 Specific Token Updates

### Phase 1: Simplify Shadow System
```css
/* BEFORE: 6+ shadow variants */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
--shadow-card: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);

/* AFTER: Minimal shadows (borders do the work) */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);  /* Only for floating elements */
/* Remove all others */
```

### Phase 2: Simplify Border Radius
```css
/* BEFORE */
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-xl: 12px;   /* ← Remove */
--radius-2xl: 16px;  /* ← Remove */

/* AFTER: Sharp technical system */
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-full: 9999px;  /* Pills/badges only */
```

### Phase 3: Add Border-First Tokens
```css
/* NEW: Make borders easier to use consistently */
--border: rgba(0, 0, 0, 0.08);
--border-hover: rgba(59, 130, 246, 0.3);  /* Blue hint on hover */
```

---

## 🔧 Component-Specific Fixes

### Fix 1: Card Components
**Files**: `src/index.css:740-782`

```css
/* BEFORE */
.card {
  box-shadow: var(--shadow-card);  /* ← Remove */
}

.query-card:hover {
  box-shadow: var(--shadow-md);  /* ← Remove */
}

.hero-card {
  background: linear-gradient(135deg, ...);  /* ← Remove gradient */
  border-radius: var(--radius-xl);  /* ← Change to lg */
}

/* AFTER */
.card {
  border: 1px solid var(--border);
  /* No shadow */
}

.query-card:hover {
  border-color: var(--border-hover);
}

.hero-card {
  background: var(--color-blue-50);
  border-radius: var(--radius-lg);
}
```

### Fix 2: Button Inline Styles
**File**: `src/pages/PivotBuilder.tsx:75-79`

**Current**:
```tsx
<Button
  variant="secondary"
  onClick={handleViewLineage}
  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
>
  <GitBranch size={16} />
  Lineage
</Button>
```

**Fix**: Button component already uses `display: inline-flex` and `gap: var(--space-2)`, so remove inline style completely:
```tsx
<Button variant="secondary" onClick={handleViewLineage}>
  <GitBranch size={16} />
  Lineage
</Button>
```

### Fix 3: Native Select Element
**File**: `src/pages/PivotBuilder.tsx:52-69`

**Problem**: Native `<select>` can't match design system

**Recommendation**: Create custom `Dropdown` component in `src/components/shared/`:
```tsx
// src/components/shared/Dropdown.tsx
interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export function Dropdown({ value, onChange, options, placeholder }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <div className="dropdown">
      <button
        className="dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selected?.label || placeholder}</span>
        <ChevronDown size={16} />
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          {options.map(opt => (
            <button
              key={opt.value}
              className="dropdown-item"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**CSS**:
```css
.dropdown-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  white-space: nowrap;  /* ← Critical: keeps text + icon on same line */
}
```

---

## 📊 Color Usage Audit

### Current Issues:

**Too much decorative blue**:
- Hero card background gradients
- Multiple blue accent uses without meaning
- Not enough gray structure

**Recommendation**: **Gray builds structure, blue signals meaning**

```css
/* Structure (gray) */
.card { background: var(--bg-surface); }
.stat-card { background: var(--bg-surface); }
.metric-value { color: var(--text-default); }

/* Meaning (blue) */
.btn-primary { background: var(--color-blue-600); }  /* Primary action */
.tab-active { color: var(--color-blue-600); }        /* Active state */
.link { color: var(--color-blue-600); }              /* Navigation */

/* Status (semantic colors) */
.score-high { color: var(--color-success-600); }     /* Success */
.score-low { color: var(--color-danger-600); }       /* Warning */
```

**Heatmap colors** (keep current system ✅):
- These are functional, not decorative
- Gradients in heat cells are appropriate
- Current scale works well

---

## 🎯 Implementation Priorities

### Phase 1: High Impact, Quick Wins
1. ✅ Remove shadows from `.card`, `.query-card` hover states
2. ✅ Change `.hero-card` gradient → solid color
3. ✅ Update `.hero-card` radius from `xl` (12px) → `lg` (8px)
4. ✅ Remove inline style from Button in PivotBuilder.tsx

### Phase 2: Token System Cleanup
5. ✅ Remove unused shadow tokens (md, lg, xl, card)
6. ✅ Remove unused radius tokens (xl, 2xl)
7. ✅ Add `--border` and `--border-hover` tokens

### Phase 3: Component Refactoring
8. 🔄 Create custom Dropdown component
9. 🔄 Replace native select with custom Dropdown
10. 🔄 Audit all components for inline styles

---

## 📏 Design System Specification

### Recommended Token System

```css
:root {
  /* SPACING - 4px grid (current ✅) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* BORDER RADIUS - Sharp technical */
  --radius-sm: 4px;   /* Small controls */
  --radius-md: 6px;   /* Buttons, inputs */
  --radius-lg: 8px;   /* Cards, modals */
  --radius-full: 9999px;  /* Pills only */

  /* BORDERS - Borders-first */
  --border: rgba(0, 0, 0, 0.08);
  --border-hover: rgba(59, 130, 246, 0.3);
  --border-default: var(--color-gray-300);  /* Keep current */
  --border-subtle: var(--color-gray-200);   /* Keep current */

  /* SHADOWS - Minimal */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);  /* Floating only */

  /* TYPOGRAPHY - Keep current ✅ */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'SF Mono', Consolas, monospace;

  /* COLORS - Keep current slate scale ✅ */
  /* HEATMAPS - Keep current scale ✅ */
}
```

### Card Surface Treatment (Consistent Across All)

```css
/* Base card chrome - same everywhere */
.card, .stat-card, .metric-card, .query-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  /* NO box-shadow */
}

.card:hover, .query-card:hover {
  border-color: var(--border-hover);
}

/* Internal layouts vary by content */
/* But container chrome stays consistent */
```

---

## 🎨 Before/After Visual Summary

### Before (Current State)
- ❌ Mixed shadows + borders (visual confusion)
- ❌ 12px and 16px rounded corners (too friendly/consumer)
- ❌ Decorative gradients (no functional purpose)
- ❌ 6 shadow variants (complexity)
- ❌ Inline styles (breaks design system)
- ❌ Native selects (can't style)

### After (Recommended)
- ✅ Borders-only depth (technical, precise)
- ✅ Max 8px corners (sharp, professional)
- ✅ Solid colors (functional, not decorative)
- ✅ Minimal shadows (only floating elements)
- ✅ CSS classes only (maintainable)
- ✅ Custom dropdowns (consistent styling)

---

## 🚀 Expected Outcomes

### User Experience
- **Faster scanning**: Borders define regions without visual noise
- **Data focus**: Charts and numbers stand out against monochrome structure
- **Professional feel**: Sharp, technical aesthetic matches user expectations
- **Consistency**: Same card treatment = predictable interface

### Developer Experience
- **Simpler system**: Fewer tokens to remember
- **Faster decisions**: "Always borders, rarely shadows"
- **Better maintenance**: No inline styles to track
- **Type safety**: Custom components > native elements

### Performance
- **Smaller CSS**: Fewer shadow layers to render
- **Faster paints**: Borders cheaper than shadows
- **Better caching**: Consistent styling = more reuse

---

## 📋 Implementation Checklist

### Immediate (This Session):
- [ ] Update `src/index.css` shadow tokens
- [ ] Update `src/index.css` border radius tokens
- [ ] Remove shadows from card hover states
- [ ] Fix hero-card gradient + radius
- [ ] Remove inline style from PivotBuilder Button

### Short Term (Next Session):
- [ ] Create custom Dropdown component
- [ ] Replace native selects
- [ ] Audit all components for inline styles
- [ ] Update component documentation

### Long Term (Future Polish):
- [ ] Storybook/component gallery
- [ ] Design system documentation
- [ ] Visual regression tests
- [ ] Dark mode refinement

---

## 🎯 Success Criteria

**The design is successful when**:
1. All cards use identical surface treatment (border, radius, no shadow)
2. Zero inline styles in components
3. Zero native form elements in styled UI
4. Color only appears when it communicates meaning
5. Power users can scan data without visual interference

---

## 💡 Key Principles Applied

From the design-principles framework:

✅ **"The 4px Grid"** - Current spacing already follows this
✅ **"Symmetrical Padding"** - Cards use consistent padding
✅ **"Border Radius Consistency"** - Need to remove xl/2xl variants
✅ **"Depth Strategy"** - Needs commitment to borders-first
✅ **"Monospace for Data"** - Already using mono for numbers
✅ **"Color for Meaning Only"** - Needs blue audit
⚠️ **"Never use native form elements"** - Need custom dropdowns
⚠️ **"Isolated Controls"** - Dropdowns need container treatment

---

**Next Action**: Would you like me to implement these changes in this branch, or create a separate design-principles branch?
