import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for Executive Dashboard
 */
export class DashboardPage extends BasePage {
  readonly scorecard: Locator;
  readonly overallScore: Locator;
  readonly statsRow: Locator;
  readonly heatmap: Locator;
  readonly campaigns: Locator;
  readonly ownerPivot: Locator;
  readonly trendChart: Locator;
  readonly tasks: Locator;
  readonly accountability: Locator;
  readonly refreshButton: Locator;
  readonly filterButtons: Locator;

  constructor(page: Page) {
    super(page);
    this.scorecard = page.locator('.scorecard');
    this.overallScore = page.locator('.score-value');
    this.statsRow = page.locator('.stats-row');
    this.heatmap = page.locator('.heatmap');
    this.campaigns = page.locator('.campaign-card');
    // OwnerPivot component renders a Card with className="pivot-card"
    this.ownerPivot = page.locator('.pivot-card');
    // TrendChart component renders a Card with className="trend-card" and inner ".trend-chart"
    this.trendChart = page.locator('.trend-card');
    this.tasks = page.locator('.tasks-card');
    this.accountability = page.locator('.accountability-card');
    this.refreshButton = page.locator('button:has-text("Refresh")');
    this.filterButtons = page.locator('.filter-btn');
  }

  /**
   * Navigate to dashboard
   */
  async goto() {
    await super.goto('/');
  }

  /**
   * Get overall health score
   */
  async getOverallScore(): Promise<number> {
    const scoreText = await this.overallScore.textContent();
    return parseInt(scoreText || '0', 10);
  }

  /**
   * Get score breakdown values
   */
  async getScoreBreakdown() {
    const dimensions = ['Complete', 'Accurate', 'Timely', 'Consistent', 'Usable'];
    const breakdown: Record<string, number> = {};

    for (const dim of dimensions) {
      const label = this.page.locator(`text=${dim}`).locator('..');
      const value = await label.locator('.score-dimension-value').textContent();
      breakdown[dim.toLowerCase()] = parseInt(value || '0', 10);
    }

    return breakdown;
  }

  /**
   * Get campaign items
   */
  async getCampaigns() {
    const campaignItems = this.campaigns.locator('.campaign-item');
    const count = await campaignItems.count();
    const campaigns = [];

    for (let i = 0; i < count; i++) {
      const item = campaignItems.nth(i);
      const name = await item.locator('.campaign-name').textContent();
      const status = await item.locator('.campaign-status').textContent();
      const progressBar = item.locator('.campaign-progress-fill');
      const progressWidth = await progressBar.evaluate((el) => {
        return parseFloat((el as HTMLElement).style.width);
      });

      campaigns.push({
        name: name?.trim(),
        status: status?.trim(),
        progress: progressWidth,
      });
    }

    return campaigns;
  }

  /**
   * Get task items
   */
  async getTasks() {
    const taskItems = this.tasks.locator('.task-item');
    const count = await taskItems.count();
    const tasks = [];

    for (let i = 0; i < count; i++) {
      const item = taskItems.nth(i);
      const title = await item.locator('.task-title').textContent();
      const priority = await item.locator('.task-priority').evaluate((el) => {
        return Array.from(el.classList).find((cls) =>
          ['critical', 'high', 'medium', 'low'].includes(cls)
        );
      });
      const assignee = await item.locator('.task-avatar').textContent();
      const overdue = (await item.locator('.task-due').textContent())?.includes('Overdue');

      tasks.push({
        title: title?.trim(),
        priority,
        assignee: assignee?.trim(),
        overdue,
      });
    }

    return tasks;
  }

  /**
   * Click refresh button
   */
  async clickRefresh() {
    await this.refreshButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Click filter button by text
   */
  async clickFilter(text: string) {
    await this.filterButtons.filter({ hasText: text }).click();
    await this.waitForPageLoad();
  }
}

