/**
 * User Settings E2E — module-declared per-user settings.
 *
 * The People module declares a `map_provider` user-setting; the
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
    // The Module Settings section is rendered when at least one
    // module declares userSettings or a settingsWidget. People +
    // Events both qualify, so this list should always be present.
    await expect(
      authenticatedPage.getByTestId('module-user-settings-list'),
    ).toBeVisible();

    // Default starts as the declared default.
    await settingsPage.expectMapProvider('google');

    await settingsPage.selectMapProvider('apple');
    // Reload and confirm the choice stuck.
    await authenticatedPage.reload();
    await settingsPage.expectMapProvider('apple');
  });
});
