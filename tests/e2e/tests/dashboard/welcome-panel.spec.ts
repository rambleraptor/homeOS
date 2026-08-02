/**
 * Dashboard E2E Tests — first-login welcome panel.
 *
 * A freshly-created user (the `authenticatedPage` fixture makes one per test)
 * should see the getting-started guide on their first visit, be able to
 * dismiss it, and never see it again — including after a full reload, which
 * proves the dismissal persisted to the user's preference record.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { DashboardPage } from '../../pages/DashboardPage';

test.describe('Dashboard welcome panel', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
    await dashboardPage.expectToBeOnDashboard();
  });

  test('shows the welcome guide to a brand-new user', async () => {
    await expect(dashboardPage.welcomePanel).toBeVisible();
    await expect(dashboardPage.welcomePanel).toContainText(/welcome to homestead/i);
  });

  test('dismissal hides the guide and persists across a reload', async ({
    authenticatedPage,
  }) => {
    // A cold reload recompiles lazy chunks on demand in dev mode, which can
    // stretch well past the default budget — same reason the login fixtures
    // use generous navigation timeouts.
    test.slow();

    await expect(dashboardPage.welcomePanel).toBeVisible();

    await dashboardPage.dismissWelcome();
    await expect(dashboardPage.welcomePanel).toBeHidden();

    await authenticatedPage.reload({ waitUntil: 'domcontentloaded' });
    await dashboardPage.expectToBeOnDashboard();
    await expect(dashboardPage.welcomePanel).toBeHidden();
  });
});
