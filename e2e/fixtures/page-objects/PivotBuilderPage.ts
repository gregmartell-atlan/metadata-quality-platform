import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for Pivot Builder
 */
export class PivotBuilderPage extends BasePage {
  readonly header: Locator;
  readonly title: Locator;
  readonly loadTemplateButton: Locator;
  readonly saveViewButton: Locator;
  readonly exportCsvButton: Locator;
  readonly tabs: Locator;
  readonly pivotSections: Locator;
  readonly pivotTables: Locator;

  constructor(page: Page) {
    super(page);
    this.header = page.locator('.pivot-builder-page .header');
    this.title = page.locator('h1:has-text("Pivot Builder")');
    this.loadTemplateButton = page.locator('button:has-text("Load Template")');
    this.saveViewButton = page.locator('button:has-text("Save View")');
    this.exportCsvButton = page.locator('button:has-text("Export CSV")');
    this.tabs = page.locator('.tabs .tab');
    this.pivotSections = page.locator('.pivot-section');
    // Demo pivots render PivotTable with className="data-table"
    this.pivotTables = page.locator('table.data-table');
  }

  /**
   * Navigate to pivot builder
   */
  async goto() {
    await super.goto('/pivot');
  }

  /**
   * Get all pivot section titles
   */
  async getPivotTitles(): Promise<string[]> {
    const titles: string[] = [];
    const count = await this.pivotSections.count();

    for (let i = 0; i < count; i++) {
      const section = this.pivotSections.nth(i);
      const title = await section.locator('.pivot-title').textContent();
      if (title) titles.push(title.trim());
    }

    return titles;
  }

  /**
   * Get tab names
   */
  async getTabNames(): Promise<string[]> {
    const tabs: string[] = [];
    const count = await this.tabs.count();

    for (let i = 0; i < count; i++) {
      const tab = this.tabs.nth(i);
      const text = await tab.textContent();
      if (text) tabs.push(text.trim());
    }

    return tabs;
  }

  /**
   * Click a tab by name
   */
  async clickTab(name: string) {
    await this.tabs.filter({ hasText: name }).click();
    await this.waitForPageLoad();
  }

  /**
   * Check if tab is active
   */
  async isTabActive(name: string): Promise<boolean> {
    const tab = this.tabs.filter({ hasText: name });
    return await tab.evaluate((el) => el.classList.contains('active'));
  }

  /**
   * Get pivot table row count
   */
  async getPivotTableRowCount(sectionIndex: number): Promise<number> {
    const section = this.pivotSections.nth(sectionIndex);
    const table = section.locator('table.data-table tbody tr');
    return await table.count();
  }

  /**
   * Get insights from a pivot section
   */
  async getInsights(sectionIndex: number) {
    const section = this.pivotSections.nth(sectionIndex);
    const insights = section.locator('.insights-panel .insight-item');
    const count = await insights.count();
    const result = [];

    for (let i = 0; i < count; i++) {
      const insight = insights.nth(i);
      const icon = insight.locator('.insight-icon');
      const type = await icon.evaluate((el) => {
        return Array.from(el.classList).find((cls) => ['danger', 'warning', 'success', 'info'].includes(cls));
      });
      // The message span is rendered via dangerouslySetInnerHTML and has no stable class
      const message = await insight.locator('span').last().textContent();

      result.push({
        type,
        message: message?.trim(),
      });
    }

    return result;
  }
}

