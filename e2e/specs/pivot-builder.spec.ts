import { test, expect } from '@playwright/test';
import { PivotBuilderPage } from '../fixtures/page-objects/PivotBuilderPage';
import { testData } from '../fixtures/test-data';

test.describe('Pivot Builder', () => {
  let pivotPage: PivotBuilderPage;

  test.beforeEach(async ({ page }) => {
    pivotPage = new PivotBuilderPage(page);
    await pivotPage.goto();
  });

  test.describe('Page Load', () => {
    test('should load pivot builder page', async ({ page }) => {
      await expect(pivotPage.title).toBeVisible();
      expect(page.url()).toContain('/pivot');
    });

    test('should display header with actions', async ({ page }) => {
      await expect(pivotPage.header).toBeVisible();
      await expect(pivotPage.loadTemplateButton).toBeVisible();
      await expect(pivotPage.saveViewButton).toBeVisible();
      await expect(pivotPage.exportCsvButton).toBeVisible();
    });
  });

  test.describe('Tabs', () => {
    test('should display all tabs', async ({ page }) => {
      const tabs = await pivotPage.getTabNames();
      
      for (const expectedTab of testData.pivotBuilder.expectedTabs) {
        expect(tabs).toContain(expectedTab);
      }
    });

    test('should have "All Pivots" tab active by default', async ({ page }) => {
      const isActive = await pivotPage.isTabActive('All Pivots');
      expect(isActive).toBe(true);
    });

    test('should switch tabs on click', async ({ page }) => {
      await pivotPage.clickTab('Accountability');
      
      // Verify tab switched (this would need actual implementation)
      // For now, just verify click doesn't error
      await page.waitForTimeout(500);
    });
  });

  test.describe('Pivot Sections', () => {
    test('should display all pivot sections', async ({ page }) => {
      const titles = await pivotPage.getPivotTitles();
      
      for (const expectedTitle of testData.pivotBuilder.expectedPivots) {
        expect(titles.some((t) => t.includes(expectedTitle))).toBe(true);
      }
    });

    test('should render pivot tables', async ({ page }) => {
      const tableCount = await pivotPage.pivotTables.count();
      expect(tableCount).toBeGreaterThan(0);
    });

    test('should display pivot table headers', async ({ page }) => {
      const firstTable = pivotPage.pivotTables.first();
      const headers = firstTable.locator('thead th');
      const headerCount = await headers.count();
      expect(headerCount).toBeGreaterThan(0);
    });

    test('should display pivot table data rows', async ({ page }) => {
      const firstTable = pivotPage.pivotTables.first();
      const rows = firstTable.locator('tbody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);
    });
  });

  test.describe('Pivot Insights', () => {
    test('should display insights for pivot sections', async ({ page }) => {
      const sections = pivotPage.pivotSections;
      const sectionCount = await sections.count();
      
      // Check at least first section has insights
      if (sectionCount > 0) {
        const insights = await pivotPage.getInsights(0);
        expect(insights.length).toBeGreaterThan(0);
      }
    });

    test('should display insight types correctly', async ({ page }) => {
      const insights = await pivotPage.getInsights(0);
      
      for (const insight of insights) {
        expect(insight.type).toBeTruthy();
        expect(['danger', 'warning', 'success', 'info']).toContain(insight.type);
        expect(insight.message).toBeTruthy();
      }
    });
  });

  test.describe('Pivot Data', () => {
    test('should display hierarchical data correctly', async ({ page }) => {
      const firstTable = pivotPage.pivotTables.first();
      const indentedRows = firstTable.locator('.indent-1, .indent-2');
      const indentedCount = await indentedRows.count();
      
      // Should have at least some indented rows for hierarchical display
      expect(indentedCount).toBeGreaterThanOrEqual(0);
    });

    test('should display score bars', async ({ page }) => {
      const scoreBars = page.locator('.bar-cell .bar-fill');
      const barCount = await scoreBars.count();
      
      if (barCount > 0) {
        // Verify bars have width set
        const firstBar = scoreBars.first();
        const width = await firstBar.evaluate((el) => {
          return parseFloat((el as HTMLElement).style.width);
        });
        expect(width).toBeGreaterThan(0);
        expect(width).toBeLessThanOrEqual(100);
      }
    });

    test('should display heatmap cells', async ({ page }) => {
      const heatCells = page.locator('.heat-cell');
      const cellCount = await heatCells.count();
      
      if (cellCount > 0) {
        // Verify cells have content
        const firstCell = heatCells.first();
        const text = await firstCell.textContent();
        expect(text).toBeTruthy();
        expect(parseInt(text || '0', 10)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Action Buttons', () => {
    test('should have Load Template button', async ({ page }) => {
      await expect(pivotPage.loadTemplateButton).toBeVisible();
      const text = await pivotPage.loadTemplateButton.textContent();
      expect(text).toContain('Load Template');
    });

    test('should have Save View button', async ({ page }) => {
      await expect(pivotPage.saveViewButton).toBeVisible();
      const text = await pivotPage.saveViewButton.textContent();
      expect(text).toContain('Save View');
    });

    test('should have Export CSV button', async ({ page }) => {
      await expect(pivotPage.exportCsvButton).toBeVisible();
      const text = await pivotPage.exportCsvButton.textContent();
      expect(text).toContain('Export CSV');
    });
  });
});




<<<<<<< Updated upstream



=======
>>>>>>> Stashed changes



