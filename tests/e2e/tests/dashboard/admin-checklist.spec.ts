/**
 * Dashboard E2E Tests — admin getting-started checklist.
 *
 * A superuser lands on the dashboard and sees the post-claim checklist (in
 * place of the generic welcome guide), with its two setup steps and a link
 * into the Users admin. Done-state is data-dependent (how many users exist,
 * whether AI is configured), so we assert the steps render rather than their
 * checked state.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { DashboardPage } from '../../pages/DashboardPage';

test.describe('Dashboard admin checklist', () => {
  test('shows the getting-started checklist to the admin', async ({
    authenticatedAdminPage,
  }) => {
    const dashboard = new DashboardPage(authenticatedAdminPage);
    await dashboard.goto();
    await dashboard.expectToBeOnDashboard();

    await expect(dashboard.adminChecklist).toBeVisible();
    await expect(
      authenticatedAdminPage.getByTestId('checklist-item-members'),
    ).toBeVisible();
    await expect(
      authenticatedAdminPage.getByTestId('checklist-item-ai'),
    ).toBeVisible();
    await expect(
      authenticatedAdminPage.getByTestId('checklist-link-members'),
    ).toHaveAttribute('href', '/superuser/users');
  });
});
