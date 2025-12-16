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
    const successMessage = this.page.locator('[role="status"], [role="alert"]').filter({ hasText: /password.*updated|success/i });
    await expect(successMessage).toBeVisible({ timeout: 5000 });
  }

  async expectPasswordChangeError(message?: string | RegExp) {
    const errorElement = this.page.locator('[role="alert"], .error').first();
    await expect(errorElement).toBeVisible();

    if (message) {
      await expect(errorElement).toContainText(message);
    }
  }
}
