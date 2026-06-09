/**
 * Navigation E2E Tests - App Navigation
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { DashboardPage } from '../../pages/DashboardPage';

test.describe('App Navigation', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
  });

  test('should navigate to Gift Cards app', async ({ authenticatedPage }) => {
    await dashboardPage.navigateToApp(/gift card/i);
    await expect(authenticatedPage).toHaveURL(/\/gift-cards/);
  });

  test('should navigate to People app', async ({ authenticatedPage }) => {
    await dashboardPage.navigateToApp(/people/i);
    await expect(authenticatedPage).toHaveURL(/\/people/);
  });

  test('should navigate to Settings app', async ({ authenticatedPage }) => {
    await dashboardPage.navigateToApp(/setting/i);
    await expect(authenticatedPage).toHaveURL(/\/settings/);
  });

  test('should navigate between apps', async ({ authenticatedPage }) => {
    // Start at dashboard
    await dashboardPage.expectToBeOnDashboard();

    // Go to gift cards
    await dashboardPage.navigateToApp(/gift card/i);
    await expect(authenticatedPage).toHaveURL(/\/gift-cards/);

    // Go to people
    await authenticatedPage.getByRole('navigation').getByRole('link', { name: /people/i }).click();
    await expect(authenticatedPage).toHaveURL(/\/people/);

    // Go to settings
    await authenticatedPage.getByRole('navigation').getByRole('link', { name: /setting/i }).click();
    await expect(authenticatedPage).toHaveURL(/\/settings/);

    // Go back to dashboard via the Homestead brand link in the sidebar header.
    // (The Dashboard app was removed from the nav in favor of this link.)
    await authenticatedPage.getByTestId('sidebar-home-link').click();
    await dashboardPage.expectToBeOnDashboard();
  });

  test('should show 404 for invalid routes', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/this-route-does-not-exist');

    // Should show 404 or Not Found
    await expect(
      authenticatedPage.getByText(/not found|404/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('should redirect root to dashboard', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');

    // Should redirect to dashboard
    await dashboardPage.expectToBeOnDashboard();
  });
});
