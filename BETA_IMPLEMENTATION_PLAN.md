# Beta Implementation Plan

> Addressing gaps identified in pre-release review
> Excludes: Data persistence & operationalization (deferred to Atlan platform integration)

---

## Phase 1: Foundation & Polish

### 1.1 Fix Hardcoded Sample Data
**Priority:** Critical
**Effort:** Small
**Files:** `src/hooks/useFieldCoverage.ts`, `src/pages/AnalyticsPage.tsx`

**Problem:** `useFieldCoverage` always returns hardcoded data. Analytics page generates sample assets but real Atlan data should flow through when available.

**Tasks:**
- [ ] Update `useFieldCoverage` to accept asset data as parameter
- [ ] Compute coverage dynamically from actual assets in scoresStore
- [ ] Keep sample data as fallback only when store is empty
- [ ] Add clear visual indicator distinguishing demo vs real data mode

---

### 1.2 Configurable Quality Rules
**Priority:** High
**Effort:** Medium
**Files:** New `src/stores/rulesStore.ts`, `src/pages/SettingsPage.tsx`

**Problem:** Thresholds (80% = excellent, 40% = critical) and field requirements are hardcoded.

**Tasks:**
- [ ] Create `rulesStore` for quality configuration:
  ```typescript
  interface QualityRules {
    thresholds: {
      excellent: number;  // default 90
      good: number;       // default 70
      fair: number;       // default 50
      poor: number;       // default 30
    };
    fieldRequirements: Record<string, 'required' | 'recommended' | 'optional'>;
    weights: {
      completeness: number;
      accuracy: number;
      // etc.
    };
  }
  ```
- [ ] Add "Quality Rules" section to Settings page
- [ ] Threshold sliders with preview
- [ ] Field requirement editor (drag between required/recommended/optional)
- [ ] Import/export rules as JSON
- [ ] Apply rules throughout scoring calculations

---

### 1.3 Error Handling & Loading States
**Priority:** High
**Effort:** Small
**Files:** Various components, new `src/components/shared/ErrorBoundary.tsx`

**Problem:** No graceful degradation when things fail. No loading indicators.

**Tasks:**
- [ ] Create `ErrorBoundary` component with friendly error UI
- [ ] Add error boundaries around major page sections
- [ ] Create `LoadingState` component (skeleton loaders)
- [ ] Add loading states to:
  - Dashboard widgets
  - Pivot tables
  - Heatmap
  - Analytics charts
- [ ] Handle Atlan connection failures gracefully
- [ ] Add retry mechanisms with exponential backoff

---

## Phase 2: User Experience

### 2.1 Onboarding & Help System
**Priority:** High
**Effort:** Medium
**Files:** New `src/components/onboarding/`, `src/components/shared/HelpTooltip.tsx`

**Tasks:**
- [ ] **First-run welcome modal:**
  - Brief intro to platform purpose
  - Key concepts explained (Quality Score, Dimensions, Coverage)
  - "Don't show again" option stored in localStorage

- [ ] **Contextual help tooltips:**
  - Add `<HelpTooltip>` component (? icon that shows explanation)
  - Add to: Quality Score display, Dimension labels, Heatmap headers
  - Include "Learn more" links

- [ ] **Empty states with guidance:**
  - When no assets loaded: "Drag assets from Atlan browser to get started"
  - When no pivots configured: "Choose dimensions to analyze your data"

- [ ] **Glossary page:**
  - Define all terminology (DaaP, Completeness, Stewardship, etc.)
  - Link from Settings or Help menu

---

### 2.2 Search & Filtering
**Priority:** High
**Effort:** Medium
**Files:** New `src/components/shared/SearchFilter.tsx`, update dashboard/analytics pages

**Tasks:**
- [ ] **Global search component:**
  - Search across asset names, owners, connections
  - Keyboard shortcut (Cmd/Ctrl + K)
  - Recent searches in localStorage

- [ ] **Dashboard filters:**
  - Filter by: Connection, Schema, Owner, Asset Type, Score Range
  - Multi-select dropdowns
  - "Clear all filters" button
  - Filter state in URL params for shareability

- [ ] **Pivot table filtering:**
  - Click dimension value to filter
  - Breadcrumb trail showing active filters
  - Quick filter pills

---

### 2.3 Export & Reporting
**Priority:** Medium
**Effort:** Medium
**Files:** New `src/utils/export.ts`, `src/components/shared/ExportButton.tsx`

**Tasks:**
- [ ] **CSV Export:**
  - Export pivot table data
  - Export asset list with scores
  - Export coverage matrix

- [ ] **PDF Report Generation:**
  - Use html2canvas + jsPDF (or similar)
  - Executive summary template
  - Include: Overall score, top issues, trend chart, recommendations
  - Branded header/footer

- [ ] **Export button placement:**
  - Add to dashboard header
  - Add to pivot table header
  - Add to analytics page sections

- [ ] **Clipboard copy:**
  - Copy table data as tab-separated (paste into Excel)
  - Copy individual charts as images

---

## Phase 3: Analytics & Insights

### 3.1 Trend Visualization
**Priority:** Medium
**Effort:** Medium
**Files:** `src/stores/snapshotStore.ts`, new `src/components/analytics/TrendChart.tsx`

**Problem:** Snapshots exist but no visualization of changes over time.

**Tasks:**
- [ ] **Trend chart component:**
  - Line chart showing score over time
  - Overlay multiple dimensions
  - Date range selector
  - Hover for snapshot details

- [ ] **Snapshot comparison:**
  - Side-by-side comparison of two snapshots
  - Highlight what improved/degraded
  - Delta indicators (+5%, -3%)

- [ ] **Dashboard trend widgets:**
  - Mini sparklines on KPI cards
  - "vs last snapshot" comparison

- [ ] **Snapshot management UI:**
  - List of snapshots with timestamps
  - Rename/delete snapshots
  - Auto-snapshot option (daily/weekly)

---

### 3.2 Actionable Recommendations
**Priority:** Medium
**Effort:** Medium
**Files:** New `src/utils/recommendations.ts`, `src/components/analytics/RecommendationPanel.tsx`

**Tasks:**
- [ ] **Recommendation engine:**
  ```typescript
  interface Recommendation {
    id: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    type: 'missing_field' | 'low_coverage' | 'no_owner' | 'stale_data';
    title: string;
    description: string;
    impact: string;  // "Fixing this will improve score by ~5%"
    assets: Asset[];
    action: string;  // "Add descriptions to these 12 tables"
  }
  ```

- [ ] **Recommendation panel:**
  - Prioritized list of actions
  - Grouped by type or impact
  - Expandable to see affected assets
  - "Dismiss" option (stored in localStorage)

- [ ] **Quick wins section:**
  - "5 fixes that will improve your score the most"
  - Show estimated impact

- [ ] **Integration points:**
  - Show recommendations on dashboard
  - Show relevant recommendations on asset detail (if exists)

---

### 3.3 Persona-Based Views
**Priority:** Low
**Effort:** Large
**Files:** New `src/components/dashboard/PersonaViews/`

**Tasks:**
- [ ] **View switcher in header:**
  - Executive View (high-level KPIs, trends)
  - Steward View (detailed coverage, remediation focus)
  - Analyst View (exploration tools, pivot focus)

- [ ] **Executive View:**
  - Large KPI cards
  - Portfolio health score
  - Trend over time
  - Top 5 issues only
  - Minimal interaction required

- [ ] **Steward View:**
  - Coverage heatmap prominent
  - Remediation queue
  - Owner compliance metrics
  - Bulk action tools

- [ ] **Analyst View:**
  - Pivot builder front and center
  - Multiple pivot configurations
  - Drill-down enabled
  - Export-heavy

---

## Phase 4: Accessibility & Polish

### 4.1 Accessibility Compliance
**Priority:** Medium
**Effort:** Medium
**Files:** Various CSS and component files

**Tasks:**
- [ ] **Color contrast audit:**
  - Run axe or Lighthouse audit
  - Fix heatmap colors for WCAG AA
  - Ensure text on colored backgrounds passes 4.5:1

- [ ] **Keyboard navigation:**
  - All interactive elements focusable
  - Logical tab order
  - Skip links for main content
  - Escape closes modals

- [ ] **Screen reader support:**
  - ARIA labels on icons and charts
  - Alt text for visualizations
  - Announce dynamic content changes
  - Table headers properly associated

- [ ] **Reduced motion:**
  - Respect `prefers-reduced-motion`
  - Provide static alternatives to animations

---

### 4.2 UI Polish
**Priority:** Low
**Effort:** Small
**Files:** Various

**Tasks:**
- [ ] **Responsive design audit:**
  - Test at common breakpoints
  - Ensure sidebar collapses properly
  - Tables scroll horizontally on mobile

- [ ] **Dark mode review:**
  - Test all components in dark mode
  - Fix any contrast issues
  - Ensure charts render correctly

- [ ] **Micro-interactions:**
  - Button hover/active states consistent
  - Form validation feedback
  - Success/error toasts

- [ ] **Performance:**
  - Lazy load heavy components
  - Virtualize long lists
  - Memoize expensive calculations

---

## Implementation Order

### Sprint 1 (Foundation)
1. Fix hardcoded sample data (1.1)
2. Error handling & loading states (1.3)
3. Search & filtering - basic (2.2 partial)

### Sprint 2 (Core UX)
4. Onboarding & help system (2.1)
5. Export - CSV (2.3 partial)
6. Configurable quality rules (1.2)

### Sprint 3 (Analytics)
7. Trend visualization (3.1)
8. Actionable recommendations (3.2)
9. Export - PDF reports (2.3 complete)

### Sprint 4 (Polish)
10. Accessibility compliance (4.1)
11. Search & filtering - advanced (2.2 complete)
12. UI polish (4.2)

### Future (Post-Beta)
13. Persona-based views (3.3)
14. Data persistence (Atlan platform)
15. Workflow integration (Atlan platform)

---

## Technical Notes

### State Management
All new stores should follow existing zustand pattern:
```typescript
// src/stores/exampleStore.ts
import { create } from 'zustand';

interface ExampleState {
  data: Thing[];
  setData: (data: Thing[]) => void;
}

export const useExampleStore = create<ExampleState>((set) => ({
  data: [],
  setData: (data) => set({ data }),
}));
```

### Component Structure
```
src/components/
├── shared/           # Reusable components
│   ├── ErrorBoundary.tsx
│   ├── LoadingState.tsx
│   ├── HelpTooltip.tsx
│   ├── SearchFilter.tsx
│   └── ExportButton.tsx
├── onboarding/       # First-run experience
│   ├── WelcomeModal.tsx
│   └── GuidedTour.tsx
└── analytics/        # Analytics-specific
    ├── TrendChart.tsx
    └── RecommendationPanel.tsx
```

### URL State for Filters
Use URLSearchParams for filter state:
```typescript
// Enables shareable filtered views
?connection=Snowflake&minScore=50&owner=data-team
```

### Local Storage Keys
Namespace all localStorage:
```
mqp.onboarding.dismissed
mqp.rules.thresholds
mqp.rules.requirements
mqp.search.recent
mqp.recommendations.dismissed
mqp.view.persona
```

---

## Success Metrics

| Feature | Success Criteria |
|---------|-----------------|
| Sample data fix | Real Atlan data flows through when available |
| Configurable rules | User can modify thresholds and see scores update |
| Error handling | No white screens; graceful fallbacks |
| Onboarding | New user understands core concepts in <2 min |
| Search/Filter | Can find specific asset in <5 seconds |
| Export | Can generate PDF report in <30 seconds |
| Trends | Can see score change over 3+ snapshots |
| Recommendations | Top 5 actionable items always visible |
| Accessibility | Lighthouse accessibility score >90 |
