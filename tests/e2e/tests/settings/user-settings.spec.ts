/**
 * User Settings E2E — app-declared per-user settings.
 *
 * The People app declares a `map_provider` user-setting; the
 * Settings page renders it via the auto-generated form. Verify the
 * value round-trips: changing the select persists across reloads.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { SettingsPage } from '../../pages/SettingsPage';

test.describe('User Settings — map provider', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    settingsPage = new SettingsPage(authenticatedPage);
    await settingsPage.goto();
  });

  test('persists per-user map provider across reloads', async ({
    authenticatedPage,
  }) => {
    // The App Settings section is rendered when at least one
    // app declares userSettings or a settingsWidget. People +
    // Events both qualify, so this list should always be present.
    await expect(
      authenticatedPage.getByTestId('app-user-settings-list'),
    ).toBeVisible();

    // Default starts as the declared default.
    await settingsPage.expectMapProvider('google');

    await settingsPage.selectMapProvider('apple');
    // Reload and confirm the choice stuck. The value is hydrated by a
    // one-shot fetch on load; under full-suite load that fetch can transiently
    // fail, so retry the reload+check rather than asserting a single reload.
    await expect(async () => {
      await authenticatedPage.reload();
      await settingsPage.expectMapProvider('apple');
    }).toPass({ timeout: 20000 });
  });
});
