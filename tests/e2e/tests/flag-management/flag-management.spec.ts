/**
 * Superuser → Flag Management sub-page E2E tests.
 *
 * Only superusers may access /superuser/flag-management. These specs
 * verify the access gate, that declared flags render with their
 * descriptions, and that edits persist into the household-wide
 * `module-flags` singleton.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { FlagManagementPage } from '../../pages/FlagManagementPage';
import { aepList, aepRemove } from '../../utils/aepbase-helpers';

interface ModuleFlagsRecord {
  id: string;
  groceries__enabled?: string;
  [field: string]: unknown;
}

async function resetModuleFlags(adminToken: string) {
  const records = await aepList<ModuleFlagsRecord>(adminToken, 'module-flags');
  for (const record of records) {
    await aepRemove(adminToken, 'module-flags', record.id);
  }
}

test.describe('Superuser → Flag Management sub-page (superuser)', () => {
  let flagPage: FlagManagementPage;

  test.beforeEach(async ({ authenticatedAdminPage, adminToken }) => {
    flagPage = new FlagManagementPage(authenticatedAdminPage);
    await resetModuleFlags(adminToken);
    await flagPage.goto();
    await flagPage.expectToBeOnFlagManagementPage();
  });

  test.afterEach(async ({ adminToken }) => {
    await resetModuleFlags(adminToken);
  });

  test('renders the groceries module section with the built-in enabled flag and its description', async () => {
    await flagPage.expectModuleSectionVisible('groceries');
    await flagPage.expectFlagDescriptionVisible(
      "Who can use this module. 'superusers' restricts it to superusers;",
    );
    // Defaults to 'all' when no record exists yet.
    await flagPage.expectEnumFlagValue('groceries', 'enabled', 'all');
  });

  test('superuser can change an enum flag and the value persists to aepbase', async ({
    adminToken,
  }) => {
    await flagPage.selectEnumFlag('groceries', 'enabled', 'superusers');

    // Poll aepbase until the singleton shows the new value (the mutation
    // round-trips through the aepbase proxy; give it a few hundred ms).
    await expect
      .poll(
        async () => {
          const records = await aepList<ModuleFlagsRecord>(
            adminToken,
            'module-flags',
          );
          return records[0]?.groceries__enabled;
        },
        { timeout: 5000 },
      )
      .toBe('superusers');

    // A reload should surface the persisted value rather than the default.
    await flagPage.goto();
    await flagPage.expectEnumFlagValue('groceries', 'enabled', 'superusers');
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
