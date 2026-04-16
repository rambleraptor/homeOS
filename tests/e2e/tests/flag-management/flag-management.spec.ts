/**
 * Flag Management module E2E tests.
 *
 * Only superusers may access /flag-management. These specs verify the
 * access gate, that declared flags render with their descriptions, and
 * that edits persist into the household-wide `module-flags` singleton.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { FlagManagementPage } from '../../pages/FlagManagementPage';
import { aepList, aepRemove } from '../../utils/aepbase-helpers';

interface ModuleFlagsRecord {
  id: string;
  settings__omnibox_access?: string;
  [field: string]: unknown;
}

async function resetModuleFlags(adminToken: string) {
  const records = await aepList<ModuleFlagsRecord>(adminToken, 'module-flags');
  for (const record of records) {
    await aepRemove(adminToken, 'module-flags', record.id);
  }
}

test.describe('Flag Management module (superuser)', () => {
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

  test('renders the settings module section with the omnibox_access flag and its description', async () => {
    await flagPage.expectModuleSectionVisible('settings');
    await flagPage.expectFlagDescriptionVisible(
      'Who can use the natural-language omnibox (⌘K / search bar).',
    );
    // Defaults to 'superuser' when no record exists yet.
    await flagPage.expectEnumFlagValue('settings', 'omnibox_access', 'superuser');
  });

  test('superuser can change an enum flag and the value persists to aepbase', async ({
    adminToken,
  }) => {
    await flagPage.selectEnumFlag('settings', 'omnibox_access', 'all');

    // Poll aepbase until the singleton shows the new value (the mutation
    // round-trips through the aepbase proxy; give it a few hundred ms).
    await expect
      .poll(
        async () => {
          const records = await aepList<ModuleFlagsRecord>(
            adminToken,
            'module-flags',
          );
          return records[0]?.settings__omnibox_access;
        },
        { timeout: 5000 },
      )
      .toBe('all');

    // A reload should surface the persisted value rather than the default.
    await flagPage.goto();
    await flagPage.expectEnumFlagValue('settings', 'omnibox_access', 'all');
  });
});

test.describe('Flag Management module (regular user gate)', () => {
  test('nav does not expose the Flag Management link for regular users', async ({
    authenticatedPage,
  }) => {
    const link = authenticatedPage.getByRole('link', { name: 'Flag Management' });
    await expect(link).toHaveCount(0);
  });

  test('direct navigation to /flag-management redirects regular users to /dashboard', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/flag-management');
    await authenticatedPage.waitForURL('/dashboard', { timeout: 5000 });
    await expect(authenticatedPage).toHaveURL(/\/dashboard$/);
  });
});
