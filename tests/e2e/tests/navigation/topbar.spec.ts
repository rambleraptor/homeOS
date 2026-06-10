/**
 * Navigation E2E Tests - Top-bar apps
 *
 * Apps with `placement: 'topbar'` (notifications, chat) render as icon
 * buttons in the header instead of sidebar links.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { DashboardPage } from '../../pages/DashboardPage';

test.describe('Top-bar apps', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
  });

  test('header shows notifications and chat buttons', async ({
    authenticatedPage,
  }) => {
    await expect(
      authenticatedPage.getByTestId('topbar-app-notifications'),
    ).toBeVisible();
    await expect(authenticatedPage.getByTestId('topbar-app-chat')).toBeVisible();
  });

  test('topbar apps do not appear in the sidebar', async ({
    authenticatedPage,
  }) => {
    const nav = authenticatedPage.getByRole('navigation');
    await expect(nav.getByRole('link', { name: /notification/i })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: /^chat$/i })).toHaveCount(0);
  });

  test('notifications button navigates to /notifications', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.getByTestId('topbar-app-notifications').click();
    await expect(authenticatedPage).toHaveURL(/\/notifications/);
  });

  test('chat button navigates to /chat and renders the app', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.getByTestId('topbar-app-chat').click();
    await expect(authenticatedPage).toHaveURL(/\/chat/);
    // The page renders without a GEMINI key — the 503 only happens on send.
    await expect(authenticatedPage.getByTestId('chat-input')).toBeVisible();
  });
});
