/**
 * General Test Helper Functions
 */

import { Page, expect } from '@playwright/test';

/**
 * Wait for toast notification to appear and optionally check its message
 */
export async function waitForToast(page: Page, expectedMessage?: string | RegExp) {
  const toast = page.locator('[role="status"], [role="alert"], .toast').first();
  await expect(toast).toBeVisible({ timeout: 5000 });

  if (expectedMessage) {
    await expect(toast).toContainText(expectedMessage);
  }

  return toast;
}

/**
 * Wait for a specific URL with retry
 */
export async function waitForUrl(page: Page, url: string | RegExp, timeout = 5000) {
  await page.waitForURL(url, { timeout });
}

/**
 * Fill a form field by label
 */
export async function fillFieldByLabel(page: Page, label: string | RegExp, value: string) {
  await page.getByLabel(label).fill(value);
}

/**
 * Click a button by name
 */
export async function clickButton(page: Page, name: string | RegExp) {
  await page.getByRole('button', { name }).click();
}

/**
 * Navigate using the main navigation
 */
export async function navigateTo(page: Page, linkName: string | RegExp) {
  await page.getByRole('navigation').getByRole('link', { name: linkName }).click();
}

/**
 * Check if element is visible
 */
export async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    await expect(page.locator(selector)).toBeVisible({ timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Reload page and wait for it to be ready
 */
export async function reloadAndWait(page: Page) {
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/**
 * Set browser offline mode
 */
export async function setOffline(page: Page) {
  await page.context().setOffline(true);
}

/**
 * Set browser online mode
 */
export async function setOnline(page: Page) {
  await page.context().setOffline(false);
}

/**
 * Check if offline banner is visible
 */
export async function expectOfflineBanner(page: Page, shouldBeVisible: boolean) {
  const banner = page.getByTestId('offline-banner');
  if (shouldBeVisible) {
    await expect(banner).toBeVisible();
  } else {
    await expect(banner).not.toBeVisible();
  }
}

/**
 * Check if pending indicator is visible on an item
 */
export async function expectPendingIndicator(page: Page, itemName: string, shouldBeVisible: boolean) {
  const item = page.getByText(itemName).locator('..');
  const pendingIndicator = item.getByTestId('pending-indicator');

  if (shouldBeVisible) {
    await expect(pendingIndicator).toBeVisible();
  } else {
    await expect(pendingIndicator).not.toBeVisible();
  }
}

/**
 * Simulate going offline, performing actions, then coming back online
 * @param page - Playwright page
 * @param offlineAction - Async function to execute while offline
 */
export async function simulateOfflineAction(page: Page, offlineAction: () => Promise<void>) {
  // Go offline
  await setOffline(page);
  await page.waitForTimeout(500); // Wait for offline detection

  // Perform the offline action
  await offlineAction();

  // Come back online
  await setOnline(page);
  await page.waitForTimeout(500); // Wait for online detection and sync
  await page.waitForLoadState('networkidle'); // Wait for sync to complete
}
