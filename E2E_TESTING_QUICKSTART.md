# E2E Testing Quick Start

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
npx playwright install
```

### 2. Start the Development Server

In one terminal:
```bash
npm run dev
```

### 3. Run Tests

In another terminal:
```bash
# Run all tests
npm run test:e2e

# Run in UI mode (recommended for first time)
npm run test:e2e:ui
```

## 📋 What's Included

### ✅ Complete Test Infrastructure
- **Playwright** configured and ready
- **Page Object Model** pattern implemented
- **Test fixtures** for consistent data
- **CI/CD workflow** for GitHub Actions

### ✅ Test Coverage

#### Navigation Tests (`e2e/specs/navigation.spec.ts`)
- ✅ Sidebar navigation
- ✅ Route highlighting
- ✅ Browser back/forward
- ✅ Direct URL navigation

#### Dashboard Tests (`e2e/specs/dashboard.spec.ts`)
- ✅ Page load and structure
- ✅ Scorecard component
- ✅ Campaigns widget
- ✅ Tasks widget
- ✅ Data visualizations
- ✅ Dashboard interactions

#### Pivot Builder Tests (`e2e/specs/pivot-builder.spec.ts`)
- ✅ Page load
- ✅ Tab navigation
- ✅ Pivot sections
- ✅ Pivot tables
- ✅ Insights display

## 📁 Project Structure

```
e2e/
├── fixtures/
│   ├── test-data.ts              # Centralized test data
│   └── page-objects/              # Page Object Models
│       ├── BasePage.ts
│       ├── DashboardPage.ts
│       └── PivotBuilderPage.ts
├── specs/                         # Test files
│   ├── navigation.spec.ts
│   ├── dashboard.spec.ts
│   └── pivot-builder.spec.ts
├── utils/                         # Test utilities
│   └── helpers.ts
└── README.md                      # Detailed documentation

playwright.config.ts               # Playwright configuration
.github/workflows/e2e.yml          # CI/CD workflow
docs/E2E_TESTING_PROPOSAL.md      # Full proposal document
```

## 🎯 Next Steps

1. **Review the Proposal**: Read `docs/E2E_TESTING_PROPOSAL.md` for complete strategy
2. **Run Tests**: Execute `npm run test:e2e:ui` to see tests in action
3. **Add Test IDs**: Consider adding `data-testid` attributes to components for stable selectors
4. **Extend Coverage**: Add tests for new features as you build them

## 🔧 Common Commands

```bash
# Run all tests
npm run test:e2e

# Run specific test file
npx playwright test e2e/specs/dashboard.spec.ts

# Run in UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug tests
npm run test:e2e:debug

# Run specific browser
npx playwright test --project=chromium
```

## 📊 Test Reports

After running tests, view HTML report:
```bash
npx playwright show-report
```

## 🐛 Debugging

### View Test Execution
```bash
npm run test:e2e:ui
```

### Debug Single Test
```bash
npm run test:e2e:debug
```

### View Traces
```bash
npx playwright show-trace test-results/trace.zip
```

## 📝 Writing New Tests

### Example: Adding a New Test

```typescript
import { test, expect } from '@playwright/test';
import { DashboardPage } from '../fixtures/page-objects/DashboardPage';

test('should display new feature', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  
  // Your test code here
  await expect(page.locator('[data-testid="new-feature"]')).toBeVisible();
});
```

## 🚨 Important Notes

1. **Development Server**: Tests automatically start the dev server, but you can also run it manually
2. **Test Data**: Currently uses mock data from `src/services/mockData.ts`
3. **Selectors**: Tests use CSS selectors - consider adding `data-testid` for stability
4. **CI/CD**: Tests run automatically on PRs and pushes to main/develop

## 📚 Documentation

- **Full Proposal**: `docs/E2E_TESTING_PROPOSAL.md`
- **E2E README**: `e2e/README.md`
- **Playwright Docs**: https://playwright.dev/

## ❓ Troubleshooting

### Tests fail to start
- Ensure dev server is running on port 5173
- Check `playwright.config.ts` baseURL

### Element not found
- Verify element is visible (not hidden)
- Check if page is fully loaded
- Review selector in Page Object

### Flaky tests
- Add explicit waits
- Use `waitForLoadState`
- Check for race conditions

## 🎉 You're Ready!

The E2E testing infrastructure is fully set up. Start by running `npm run test:e2e:ui` to see the tests in action!




<<<<<<< Updated upstream



=======
>>>>>>> Stashed changes



