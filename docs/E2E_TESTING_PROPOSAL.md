# End-to-End Testing Proposal

## Overview

This document outlines the end-to-end (E2E) testing strategy for the Metadata Quality Platform. E2E tests validate complete user workflows from the browser perspective, ensuring the application works correctly as users interact with it.

## Testing Framework: Playwright

**Recommended Framework**: [Playwright](https://playwright.dev/)

### Why Playwright?

1. **Cross-browser support**: Chromium, Firefox, WebKit
2. **Fast and reliable**: Built-in auto-waiting and retry mechanisms
3. **Modern API**: Async/await support, TypeScript-first
4. **Great debugging**: Trace viewer, screenshots, video recording
5. **CI/CD ready**: Excellent GitHub Actions integration
6. **React-friendly**: Works seamlessly with Vite dev server

### Alternative Consideration

- **Cypress**: Also excellent, but Playwright offers better performance and multi-browser support out of the box

## Test Structure

```
e2e/
├── fixtures/
│   ├── test-data.ts          # Test data fixtures
│   └── page-objects/         # Page Object Model classes
│       ├── DashboardPage.ts
│       ├── PivotBuilderPage.ts
│       └── BasePage.ts
├── specs/
│   ├── navigation.spec.ts     # Navigation and routing tests
│   ├── dashboard.spec.ts     # Executive dashboard tests
│   ├── pivot-builder.spec.ts # Pivot builder functionality
│   ├── data-visualization.spec.ts # Charts and visualizations
│   └── responsive.spec.ts    # Mobile/responsive tests
├── utils/
│   ├── helpers.ts            # Test utilities
│   └── constants.ts          # Test constants
└── playwright.config.ts      # Playwright configuration
```

## Test Scenarios

### 1. Navigation & Routing

**Priority: High**

- [ ] Sidebar navigation works correctly
- [ ] Active route highlighting in sidebar
- [ ] Direct URL navigation (e.g., `/pivot`)
- [ ] Browser back/forward navigation
- [ ] Logo/branding click behavior

**Test Cases**:
```typescript
- Navigate from Executive Overview to Pivot Builder
- Verify active state updates in sidebar
- Navigate to placeholder pages (Stewardship, Campaigns, etc.)
- Test deep linking to specific routes
```

### 2. Executive Dashboard

**Priority: High**

#### 2.1 Scorecard Component
- [ ] Overall health score displays correctly
- [ ] Score breakdown (Completeness, Accuracy, Timeliness, etc.) renders
- [ ] Trend indicator shows correct direction (up/down)
- [ ] Score colors match thresholds (excellent/good/fair/poor/critical)

#### 2.2 Stats Row
- [ ] All stat cards render with correct values
- [ ] Trend indicators display correctly
- [ ] Values match expected format

#### 2.3 Heatmap
- [ ] Domain quality heatmap renders
- [ ] Color coding matches score ranges
- [ ] Hover interactions work (if implemented)
- [ ] Data accuracy verification

#### 2.4 Campaigns Widget
- [ ] Campaign list displays all campaigns
- [ ] Progress bars reflect correct percentages
- [ ] Status badges show correct state (active/at-risk)
- [ ] Date formatting is correct
- [ ] Task counts display accurately

#### 2.5 Owner Pivot
- [ ] Owner groups display correctly
- [ ] Score distribution visualization renders
- [ ] Data totals are accurate

#### 2.6 Trend Chart
- [ ] Chart renders without errors
- [ ] Data points display correctly
- [ ] Time series data is accurate
- [ ] Chart is interactive (if implemented)

#### 2.7 Tasks Widget
- [ ] Task list displays correctly
- [ ] Priority indicators show correct colors
- [ ] Overdue tasks are highlighted
- [ ] Due date formatting is correct
- [ ] Assignee avatars display

#### 2.8 Accountability Component
- [ ] Steward data displays correctly
- [ ] Metrics are accurate

#### 2.9 Dashboard Interactions
- [ ] Filter buttons work (All Domains, Last 30 Days)
- [ ] Refresh button functionality
- [ ] Dashboard loads without errors
- [ ] All components render in correct layout

### 3. Pivot Builder

**Priority: High**

#### 3.1 Page Load & Structure
- [ ] Page loads correctly
- [ ] Header with title displays
- [ ] Action buttons render (Load Template, Save View, Export CSV)
- [ ] Tab navigation displays correctly

#### 3.2 Pivot Tables
- [ ] All pivot sections render
- [ ] Table headers display correctly
- [ ] Data rows populate with correct values
- [ ] Hierarchical data (indented rows) displays correctly
- [ ] Score bars render with correct widths
- [ ] Color coding matches score ranges
- [ ] Distribution visualizations render

#### 3.3 Pivot Insights
- [ ] Insight messages display
- [ ] Correct insight types (danger/warning/success/info)
- [ ] Insight content is accurate

#### 3.4 Pivot Interactions (Future)
- [ ] Tab switching works
- [ ] Export CSV functionality (when implemented)
- [ ] Load Template functionality (when implemented)
- [ ] Save View functionality (when implemented)

### 4. Data Visualization

**Priority: Medium**

- [ ] Charts render without console errors
- [ ] Data accuracy in visualizations
- [ ] Color schemes are consistent
- [ ] Responsive behavior of charts
- [ ] Tooltips/interactions work (if implemented)

### 5. Responsive Design

**Priority: Medium**

- [ ] Mobile view (< 768px)
- [ ] Tablet view (768px - 1024px)
- [ ] Desktop view (> 1024px)
- [ ] Sidebar behavior on mobile
- [ ] Dashboard grid layout adapts
- [ ] Pivot tables are scrollable on mobile

### 6. Accessibility

**Priority: Medium**

- [ ] Keyboard navigation works
- [ ] Screen reader compatibility
- [ ] ARIA labels present
- [ ] Color contrast meets WCAG standards
- [ ] Focus indicators visible

### 7. Performance

**Priority: Low**

- [ ] Page load time < 3 seconds
- [ ] Dashboard renders within acceptable time
- [ ] No memory leaks during navigation
- [ ] Smooth animations/transitions

## Test Data Strategy

### Mock Data
- Current implementation uses `mockData.ts`
- Tests should verify data displays correctly
- Consider creating test-specific mock data for edge cases

### Future API Integration
- When backend API is integrated, use:
  - Test database with known data
  - API mocking for consistent tests
  - Data seeding utilities

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/e2e.yml
- Run E2E tests on:
  - Pull requests
  - Main branch commits
  - Scheduled nightly runs
- Test on multiple browsers (Chromium, Firefox, WebKit)
- Generate test reports
- Upload screenshots/videos on failure
```

### Test Execution

```bash
# Run all tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- specs/dashboard.spec.ts

# Run in UI mode (debugging)
npm run test:e2e:ui

# Run in headed mode
npm run test:e2e:headed
```

## Coverage Goals

### Phase 1 (MVP) - 60% Coverage
- Critical navigation flows
- Dashboard core components
- Pivot Builder basic functionality

### Phase 2 - 80% Coverage
- All dashboard components
- Complete pivot builder features
- Responsive design
- Accessibility basics

### Phase 3 - 90%+ Coverage
- Edge cases
- Error scenarios
- Performance testing
- Cross-browser compatibility

## Test Maintenance

### Best Practices
1. **Page Object Model**: Encapsulate page interactions in reusable classes
2. **Test Data**: Centralize test data in fixtures
3. **Selectors**: Use data-testid attributes for stable selectors
4. **Isolation**: Each test should be independent
5. **Cleanup**: Reset state between tests
6. **Documentation**: Comment complex test scenarios

### Adding Test IDs

Recommend adding `data-testid` attributes to key elements:

```tsx
// Example
<Card className="scorecard" title="Overall Health" data-testid="scorecard">
  {/* ... */}
</Card>
```

## Timeline & Effort Estimate

### Setup & Initial Tests (Week 1)
- Playwright setup: 4 hours
- Navigation tests: 4 hours
- Dashboard core tests: 8 hours
- **Total: ~16 hours**

### Complete Coverage (Weeks 2-3)
- Pivot Builder tests: 8 hours
- Data visualization tests: 4 hours
- Responsive tests: 4 hours
- CI/CD integration: 4 hours
- **Total: ~20 hours**

### Ongoing Maintenance
- ~2-4 hours per sprint for new features
- ~1 hour per sprint for maintenance

## Success Metrics

- **Test Reliability**: > 95% pass rate
- **Execution Time**: < 5 minutes for full suite
- **Coverage**: 80%+ of critical user flows
- **Bug Detection**: Catch regressions before production

## Next Steps

1. ✅ Review and approve this proposal
2. ⬜ Install Playwright and dependencies
3. ⬜ Set up test structure and configuration
4. ⬜ Add data-testid attributes to key components
5. ⬜ Write initial navigation tests
6. ⬜ Write dashboard component tests
7. ⬜ Write pivot builder tests
8. ⬜ Set up CI/CD integration
9. ⬜ Document test execution and maintenance

## Questions & Considerations

1. **Backend Integration**: When will real API be available? Need to plan for API mocking.
2. **Authentication**: Will auth be required? Need to add auth flows to tests.
3. **Test Environment**: Separate test environment or use dev environment?
4. **Visual Regression**: Consider adding visual regression testing (e.g., Percy, Chromatic)?
5. **Performance Budget**: Define acceptable performance thresholds?

