/**
 * Settings Page Object Model
 */

import { Page, expect } from '@playwright/test';

export class SettingsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings');
  }

  async expectToBeOnSettingsPage() {
    await expect(this.page).toHaveURL(/\/settings/);
  }

  async changePassword(currentPassword: string, newPassword: string, confirmPassword?: string) {
    await this.page.getByLabel(/current password|old password/i).fill(currentPassword);
    await this.page.getByLabel(/^new password/i).fill(newPassword);
    await this.page.getByLabel(/confirm password|confirm new password/i).fill(confirmPassword || newPassword);
    await this.page.getByRole('button', { name: /change password|update password/i }).click();
  }

  async expectPasswordChangeSuccess() {
    // Sonner toast with success message
    // Toasts typically appear with data attributes like [data-sonner-toast]
    // and contain the success text "Password changed successfully"
    const successToast = this.page.getByText(/password.*changed.*successfully/i);
    await expect(successToast).toBeVisible({ timeout: 5000 });
  }

  async expectPasswordChangeError(message?: string | RegExp) {
    // Error can appear either as inline error or as toast
    // Inline error: <div className="p-3 text-sm bg-red-50/20 text-red-600 rounded-md">
    // Toast error: Sonner toast with error type

    if (message) {
      // Look for text matching the error message pattern
      const errorText = this.page.getByText(message).first();
      await expect(errorText).toBeVisible({ timeout: 5000 });
    } else {
      // Look for any error indicator
      const errorElement = this.page.locator('.text-red-600, [data-type="error"]').first();
      await expect(errorElement).toBeVisible({ timeout: 5000 });
    }
  }

  /**
   * Per-user "map provider" setting, declared by the People module and
   * rendered through the auto-generated form in the Module Settings
   * section of the Settings page.
   */
  async selectMapProvider(provider: 'google' | 'apple') {
    const select = this.page.getByTestId('user-setting-people-map_provider');
    // The change handler persists the value to the user's `preferences`
    // record. Wait for that write to land so a subsequent reload reads the
    // saved value rather than racing the in-flight save.
    const saved = this.page.waitForResponse(
      (r) =>
        /\/preferences(\/|\?|$)/.test(r.url()) &&
        ['POST', 'PATCH'].includes(r.request().method()) &&
        r.ok(),
    );
    await select.selectOption(provider);
    await saved;
  }

  async expectMapProvider(provider: 'google' | 'apple') {
    const select = this.page.getByTestId('user-setting-people-map_provider');
    await expect(select).toHaveValue(provider);
  }
}
