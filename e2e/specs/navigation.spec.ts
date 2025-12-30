import { test, expect } from '@playwright/test';
import { DashboardPage } from '../fixtures/page-objects/DashboardPage';
import { PivotBuilderPage } from '../fixtures/page-objects/PivotBuilderPage';
import { testData } from '../fixtures/test-data';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Start from dashboard
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
  });

  test('should navigate to Pivot Builder from sidebar', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    
    // Click Pivot Builder in sidebar
    await dashboardPage.clickSidebarNav('Pivot Builder');
    
    // Verify navigation
    expect(page.url()).toContain('/pivot');
    
    // Verify page loaded
    const pivotPage = new PivotBuilderPage(page);
    await expect(pivotPage.title).toBeVisible();
  });

  test('should highlight active route in sidebar', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    
    // Verify Executive Overview is active
    const isActive = await dashboardPage.isNavActive('Executive Overview');
    expect(isActive).toBe(true);
    
    // Navigate to Pivot Builder
    await dashboardPage.clickSidebarNav('Pivot Builder');
    
    // Verify Pivot Builder is now active
    const pivotPage = new PivotBuilderPage(page);
    const isPivotActive = await pivotPage.isNavActive('Pivot Builder');
    expect(isPivotActive).toBe(true);
  });

  test('should navigate to all routes', async ({ page }) => {
    const routes = testData.navigation.routes;
    
    for (const route of routes) {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      
      // Verify URL changed
      expect(page.url()).toContain(route.path);
      
      // Verify sidebar contains the nav item for this route (active state is covered elsewhere)
      const navItem = page.locator('aside.sidebar a.nav-item', { hasText: route.name }).first();
      await expect(navItem).toBeVisible();
    }
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    
    // Navigate to Pivot Builder
    await dashboardPage.clickSidebarNav('Pivot Builder');
    expect(page.url()).toContain('/pivot');
    
    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toMatch(/\/$|\/\/localhost/);
    
    // Go forward
    await page.goForward();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/pivot');
  });

  test('should navigate via direct URL', async ({ page }) => {
    // Navigate directly to pivot builder
    await page.goto('/pivot');
    await page.waitForLoadState('networkidle');
    
    expect(page.url()).toContain('/pivot');
    
    const pivotPage = new PivotBuilderPage(page);
    await expect(pivotPage.title).toBeVisible();
  });

  test('should display sidebar on all pages', async ({ page }) => {
    const routes = testData.navigation.routes;
    
    for (const route of routes) {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      
      const sidebar = page.locator('aside.sidebar');
      await expect(sidebar).toBeVisible();
      
      // Verify logo is visible
      const logo = sidebar.locator('.logo');
      await expect(logo).toBeVisible();
    }
  });
});

