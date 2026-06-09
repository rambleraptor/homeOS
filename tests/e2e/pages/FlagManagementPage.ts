/**
 * Flag Management Page Object Model
 *
 * Drives the superuser-only /superuser/flag-management surface that
 * lists every declared app flag and lets an operator flip values.
 */

import { Page, expect } from '@playwright/test';

export class FlagManagementPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/superuser/flag-management');
  }

  async expectToBeOnFlagManagementPage() {
    await expect(this.page).toHaveURL(/\/superuser\/flag-management$/);
    await expect(
      this.page.getByRole('heading', { name: 'Flag Management', level: 1 }),
    ).toBeVisible();
  }

  async expectAppSectionVisible(appId: string) {
    await expect(this.page.getByTestId(`flag-app-${appId}`)).toBeVisible();
  }

  async expectFlagDescriptionVisible(description: string) {
    await expect(this.page.getByText(description).first()).toBeVisible();
  }

  async selectEnumFlag(appId: string, key: string, value: string) {
    const control = this.page.getByTestId(`flag-${appId}-${key}`);
    await control.waitFor({ state: 'visible' });
    await control.selectOption(value);
  }

  async expectEnumFlagValue(appId: string, key: string, value: string) {
    const control = this.page.getByTestId(`flag-${appId}-${key}`);
    await expect(control).toHaveValue(value);
  }
}
