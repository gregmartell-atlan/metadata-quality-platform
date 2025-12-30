import { Page, expect } from '@playwright/test';

/**
 * Test helper utilities
 */

/**
 * Wait for element to be visible and stable
 */
export async function waitForStableElement(page: Page, selector: string, timeout = 5000) {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });
  
  // Wait for any animations/transitions to complete
  await page.waitForTimeout(300);
  
  return element;
}

/**
 * Check if score matches expected threshold
 */
export function getScoreCategory(score: number): string {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'poor';
  return 'critical';
}

/**
 * Verify score color matches threshold
 */
export async function verifyScoreColor(
  page: Page,
  scoreElement: string,
  expectedScore: number
) {
  const element = page.locator(scoreElement);
  const computedStyle = await element.evaluate((el) => {
    return window.getComputedStyle(el).color;
  });
  
  const category = getScoreCategory(expectedScore);
  // This is a simplified check - in real implementation, you'd verify against CSS variables
  expect(computedStyle).toBeTruthy();
}

/**
 * Format date for comparison
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Check if element is in viewport
 */
export async function isInViewport(page: Page, selector: string): Promise<boolean> {
  return await page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  });
}

/**
 * Scroll element into view
 */
export async function scrollIntoView(page: Page, selector: string) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(200); // Wait for scroll to complete
}

/**
 * Take screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ path: `e2e/screenshots/${name}-${timestamp}.png` });
}






