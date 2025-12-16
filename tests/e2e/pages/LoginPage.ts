/**
 * Login Page Object Model
 */

import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.getByLabel(/email/i).fill(email);
    await this.page.getByLabel(/password/i).fill(password);
    await this.page.getByRole('button', { name: /login|sign in/i }).click();
  }

  async expectLoginError(message?: string | RegExp) {
    const errorElement = this.page.locator('[role="alert"], .error, .text-red-500').first();
    await expect(errorElement).toBeVisible();

    if (message) {
      await expect(errorElement).toContainText(message);
    }
  }

  async expectToBeOnLoginPage() {
    await expect(this.page).toHaveURL(/\/login/);
  }
}
