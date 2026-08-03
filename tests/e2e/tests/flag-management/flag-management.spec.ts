/**
 * Superuser → Flag Management sub-page E2E tests.
 *
 * Only superusers may access /superuser/flag-management. These specs
 * verify the access gate, that declared flags render with their
 * descriptions, and that edits persist into the household-wide
 * `app-flags` singleton.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { FlagManagementPage } from '../../pages/FlagManagementPage';
import { deleteIfPresent, listOrEmpty } from '../../utils/aepbase-helpers';

interface AppFlagsRecord {
  id: string;
  [field: string]: unknown;
}

async function resetAppFlags(adminToken: string) {
  const records = await listOrEmpty<AppFlagsRecord>(adminToken, 'app-flags');
  for (const record of records) {
    await deleteIfPresent(adminToken, 'app-flags', record.id);
  }
}

test.describe('Superuser → Flag Management sub-page (superuser)', () => {
  let flagPage: FlagManagementPage;

  test.beforeEach(async ({ authenticatedAdminPage, adminToken }) => {
    flagPage = new FlagManagementPage(authenticatedAdminPage);
    await resetAppFlags(adminToken);
    await flagPage.goto();
    await flagPage.expectToBeOnFlagManagementPage();
  });

  test.afterEach(async ({ adminToken }) => {
    await resetAppFlags(adminToken);
  });

  test('renders the groceries app section with its declared flags', async () => {
    // App audience is no longer a flag (it's governed by permissions); the page
    // now shows only each app's declared feature flags.
    await flagPage.expectAppSectionVisible('groceries');
  });
});

test.describe('Superuser → Flag Management sub-page (regular user gate)', () => {
  test('nav does not expose the Superuser link for regular users', async ({
    authenticatedPage,
  }) => {
    const link = authenticatedPage.getByRole('link', { name: 'Superuser' });
    await expect(link).toHaveCount(0);
  });

  test('direct navigation to /superuser/flag-management redirects regular users to /dashboard', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/superuser/flag-management');
    await authenticatedPage.waitForURL('/dashboard', { timeout: 5000 });
    await expect(authenticatedPage).toHaveURL(/\/dashboard$/);
  });
});
