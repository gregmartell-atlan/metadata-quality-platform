import { test, expect } from '@playwright/test';
import { DashboardPage } from '../fixtures/page-objects/DashboardPage';
import { testData } from '../fixtures/test-data';
import { getScoreCategory } from '../utils/helpers';

test.describe('Executive Dashboard', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
  });

  test.describe('Page Load', () => {
    test('should load dashboard successfully', async ({ page }) => {
      await expect(page.locator('.executive-dashboard')).toBeVisible();
      await expect(dashboardPage.scorecard).toBeVisible();
    });

    test('should display dashboard header', async ({ page }) => {
      const header = page.locator('.dashboard-header');
      await expect(header).toBeVisible();
      
      const title = header.locator('h1:has-text("Executive Overview")');
      await expect(title).toBeVisible();
    });

    test('should render all dashboard components', async ({ page }) => {
      await expect(dashboardPage.scorecard).toBeVisible();
      await expect(dashboardPage.statsRow).toBeVisible();
      await expect(dashboardPage.heatmap).toBeVisible();
      await expect(dashboardPage.campaigns).toBeVisible();
      await expect(dashboardPage.ownerPivot).toBeVisible();
      await expect(dashboardPage.trendChart).toBeVisible();
      await expect(dashboardPage.tasks).toBeVisible();
      await expect(dashboardPage.accountability).toBeVisible();
    });
  });

  test.describe('Scorecard Component', () => {
    test('should display overall health score', async ({ page }) => {
      const score = await dashboardPage.getOverallScore();
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
      
      // Verify score matches expected value from mock data
      expect(score).toBe(testData.dashboard.expectedScorecard.overall);
    });

    test('should display score breakdown', async ({ page }) => {
      const breakdown = await dashboardPage.getScoreBreakdown();
      
      expect(breakdown.complete).toBe(testData.dashboard.expectedScorecard.completeness);
      expect(breakdown.accurate).toBe(testData.dashboard.expectedScorecard.accuracy);
      expect(breakdown.timely).toBe(testData.dashboard.expectedScorecard.timeliness);
      expect(breakdown.consistent).toBe(testData.dashboard.expectedScorecard.consistency);
      expect(breakdown.usable).toBe(testData.dashboard.expectedScorecard.usability);
    });

    test('should display trend indicator', async ({ page }) => {
      const trend = page.locator('.score-trend');
      await expect(trend).toBeVisible();
      
      const trendText = await trend.textContent();
      expect(trendText).toMatch(/↑|↓/); // Should contain up or down arrow
    });

    test('should color code scores correctly', async ({ page }) => {
      const breakdown = await dashboardPage.getScoreBreakdown();
      
      // Verify each dimension has appropriate color based on score
      for (const [dimension, score] of Object.entries(breakdown)) {
        const category = getScoreCategory(score);
        expect(['excellent', 'good', 'fair', 'poor', 'critical']).toContain(category);
      }
    });
  });

  test.describe('Campaigns Widget', () => {
    test('should display campaign list', async ({ page }) => {
      await expect(dashboardPage.campaigns).toBeVisible();
      
      const campaigns = await dashboardPage.getCampaigns();
      expect(campaigns.length).toBeGreaterThan(0);
    });

    test('should display correct campaign data', async ({ page }) => {
      const campaigns = await dashboardPage.getCampaigns();
      
      // Verify first campaign matches expected data
      const firstCampaign = campaigns[0];
      expect(firstCampaign.name).toBe(testData.dashboard.expectedCampaigns[0].name);
      expect(firstCampaign.status).toContain('Track'); // "On Track" or "At Risk"
      expect(firstCampaign.progress).toBe(testData.dashboard.expectedCampaigns[0].progress);
    });

    test('should display progress bars', async ({ page }) => {
      const progressBars = dashboardPage.campaigns.locator('.campaign-progress-fill');
      const count = await progressBars.count();
      expect(count).toBeGreaterThan(0);
      
      // Verify progress bars have width set
      for (let i = 0; i < count; i++) {
        const bar = progressBars.nth(i);
        const width = await bar.evaluate((el) => {
          return parseFloat((el as HTMLElement).style.width);
        });
        expect(width).toBeGreaterThan(0);
        expect(width).toBeLessThanOrEqual(100);
      }
    });

    test('should display campaign status badges', async ({ page }) => {
      const statusBadges = dashboardPage.campaigns.locator('.campaign-status');
      const count = await statusBadges.count();
      expect(count).toBeGreaterThan(0);
      
      for (let i = 0; i < count; i++) {
        const badge = statusBadges.nth(i);
        await expect(badge).toBeVisible();
        const text = await badge.textContent();
        expect(text).toMatch(/On Track|At Risk/);
      }
    });
  });

  test.describe('Tasks Widget', () => {
    test('should display task list', async ({ page }) => {
      await expect(dashboardPage.tasks).toBeVisible();
      
      const tasks = await dashboardPage.getTasks();
      expect(tasks.length).toBeGreaterThan(0);
    });

    test('should display task details', async ({ page }) => {
      const tasks = await dashboardPage.getTasks();
      
      // Verify first task matches expected data
      const firstTask = tasks[0];
      expect(firstTask.title).toBe(testData.dashboard.expectedTasks[0].title);
      expect(firstTask.priority).toBe(testData.dashboard.expectedTasks[0].priority);
      expect(firstTask.assignee).toBe(testData.dashboard.expectedTasks[0].assignee);
      expect(firstTask.overdue).toBe(testData.dashboard.expectedTasks[0].overdue);
    });

    test('should highlight overdue tasks', async ({ page }) => {
      const overdueTasks = dashboardPage.tasks.locator('.task-due.overdue');
      const count = await overdueTasks.count();
      
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const task = overdueTasks.nth(i);
          const text = await task.textContent();
          expect(text).toContain('Overdue');
        }
      }
    });

    test('should display priority indicators', async ({ page }) => {
      const priorityIndicators = dashboardPage.tasks.locator('.task-priority');
      const count = await priorityIndicators.count();
      expect(count).toBeGreaterThan(0);
      
      for (let i = 0; i < count; i++) {
        const indicator = priorityIndicators.nth(i);
        const classes = await indicator.evaluate((el) => Array.from(el.classList));
        const hasPriority = ['critical', 'high', 'medium', 'low'].some((p) =>
          classes.includes(p)
        );
        expect(hasPriority).toBe(true);
      }
    });
  });

  test.describe('Dashboard Interactions', () => {
    test('should display filter buttons', async ({ page }) => {
      await expect(dashboardPage.filterButtons).toHaveCount(2);
      
      const filterTexts = await dashboardPage.filterButtons.allTextContents();
      expect(filterTexts).toContain('All Domains');
      expect(filterTexts).toContain('Last 30 Days');
    });

    test('should highlight active filter', async ({ page }) => {
      const allDomainsFilter = dashboardPage.filterButtons.filter({ hasText: 'All Domains' });
      const isActive = await allDomainsFilter.evaluate((el) =>
        el.classList.contains('active')
      );
      expect(isActive).toBe(true);
    });

    test('should have refresh button', async ({ page }) => {
      await expect(dashboardPage.refreshButton).toBeVisible();
      const text = await dashboardPage.refreshButton.textContent();
      expect(text).toContain('Refresh');
    });
  });

  test.describe('Data Visualization', () => {
    test('should render heatmap without errors', async ({ page }) => {
      await expect(dashboardPage.heatmap).toBeVisible();
      
      // Check for console errors
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.waitForTimeout(1000); // Wait for any async rendering
      expect(errors.length).toBe(0);
    });

    test('should render trend chart without errors', async ({ page }) => {
      await expect(dashboardPage.trendChart).toBeVisible();
      
      // Verify chart container exists
      const chartContainer = dashboardPage.trendChart.locator('svg, canvas');
      await expect(chartContainer.first()).toBeVisible({ timeout: 5000 });
    });
  });
});




<<<<<<< Updated upstream



=======
>>>>>>> Stashed changes



