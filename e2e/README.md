# E2E Testing Guide

This directory contains end-to-end tests for the Metadata Quality Platform using Playwright.

## Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

```bash
# Install dependencies (includes Playwright)
npm install

# Install Playwright browsers
npx playwright install
```

### Running Tests

```bash
# Run all tests headlessly
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug tests
npm run test:e2e:debug

# Run specific test file
npx playwright test e2e/specs/dashboard.spec.ts

# Run tests in specific browser
npx playwright test --project=chromium
```

## Test Structure

```
e2e/
├── fixtures/
│   ├── test-data.ts          # Test data fixtures
│   └── page-objects/         # Page Object Model classes
│       ├── BasePage.ts       # Base page class
│       ├── DashboardPage.ts  # Dashboard page object
│       └── PivotBuilderPage.ts # Pivot builder page object
├── specs/
│   ├── navigation.spec.ts    # Navigation tests
│   ├── dashboard.spec.ts     # Dashboard tests
│   └── pivot-builder.spec.ts # Pivot builder tests
└── utils/
    └── helpers.ts            # Test utilities
```

## Writing Tests

### Using Page Objects

Page Objects encapsulate page interactions and make tests more maintainable:

```typescript
import { test, expect } from '@playwright/test';
import { DashboardPage } from '../fixtures/page-objects/DashboardPage';

test('should display scorecard', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  
  const score = await dashboard.getOverallScore();
  expect(score).toBeGreaterThan(0);
});
```

### Adding Test IDs

For stable selectors, add `data-testid` attributes to components:

```tsx
<Card data-testid="scorecard" title="Overall Health">
  {/* ... */}
</Card>
```

Then use in tests:

```typescript
await expect(page.locator('[data-testid="scorecard"]')).toBeVisible();
```

## Test Data

Test data is centralized in `e2e/fixtures/test-data.ts`. Update this file when mock data changes.

## Debugging

### UI Mode

```bash
npm run test:e2e:ui
```

Opens Playwright's interactive UI where you can:
- See tests running in real-time
- Step through tests
- Inspect elements
- View network requests

### Debug Mode

```bash
npm run test:e2e:debug
```

Opens browser DevTools for debugging.

### Screenshots and Videos

Failed tests automatically capture:
- Screenshots: `test-results/`
- Videos: `test-results/`
- Traces: `test-results/`

View traces:
```bash
npx playwright show-trace test-results/trace.zip
```

## CI/CD

Tests run automatically on:
- Pull requests
- Pushes to main/develop branches
- Manual workflow dispatch

See `.github/workflows/e2e.yml` for configuration.

## Best Practices

1. **Use Page Objects**: Encapsulate page interactions
2. **Test Data**: Centralize test data in fixtures
3. **Selectors**: Prefer `data-testid` over CSS selectors
4. **Isolation**: Each test should be independent
5. **Wait Strategies**: Use Playwright's auto-waiting
6. **Assertions**: Use Playwright's expect API

## Troubleshooting

### Tests fail locally but pass in CI

- Check browser versions match
- Verify environment variables
- Check for timing issues (add waits)

### Element not found

- Verify element is visible (not hidden)
- Check if element is in iframe
- Ensure page is fully loaded

### Flaky tests

- Add explicit waits
- Use `waitForLoadState`
- Check for race conditions
- Review test isolation

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Test Generator](https://playwright.dev/docs/codegen) - Record tests interactively




<<<<<<< Updated upstream



=======
>>>>>>> Stashed changes



