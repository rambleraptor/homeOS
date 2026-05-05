/**
 * Global offline banner — fires on every authenticated page (not just
 * groceries). Walks two routes to prove the banner is mounted in
 * `AppShell`, not on a single screen.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';

test.describe('Offline banner', () => {
  test('appears on every authenticated page when the network drops', async ({
    page,
    context,
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/todos');
    await expect(page.getByTestId('offline-banner')).toBeHidden();

    await context.setOffline(true);
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await expect(page.getByTestId('offline-banner')).toContainText(/offline/i);

    // Same banner instance is mounted by AppShell, so navigating doesn't
    // unmount it. Switch to /people to prove it isn't groceries-specific.
    await authenticatedPage.goto('/people');
    await expect(page.getByTestId('offline-banner')).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByTestId('offline-banner')).toBeHidden();
  });
});
