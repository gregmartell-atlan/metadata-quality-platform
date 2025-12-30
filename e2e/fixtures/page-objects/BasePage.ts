import { Page, Locator } from '@playwright/test';

/**
 * Base page object class
 * Provides common functionality for all page objects
 */
export class BasePage {
  readonly page: Page;
  readonly sidebar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('aside.sidebar');
  }

  /**
   * Navigate to a specific route
   */
  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get the current route
   */
  getCurrentPath(): string {
    return new URL(this.page.url()).pathname;
  }

  /**
   * Click on sidebar navigation item
   */
  async clickSidebarNav(text: string) {
    await this.sidebar.locator('a.nav-item', { hasText: text }).first().click();
    await this.waitForPageLoad();
  }

  /**
   * Check if sidebar nav item is active
   */
  async isNavActive(text: string): Promise<boolean> {
    const navItem = this.sidebar.locator('a.nav-item', { hasText: text }).first();
    return await navItem.evaluate((el) => el.classList.contains('active'));
  }
}

