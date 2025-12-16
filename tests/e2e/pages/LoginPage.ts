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

    // Click login button and wait for navigation or error
    const loginButton = this.page.getByRole('button', { name: /login|sign in/i });
    await loginButton.click();

    // Wait a bit for the async login to complete
    // The page will either redirect (success) or show an error (failure)
    await this.page.waitForTimeout(1000);
  }

  async expectLoginError(message?: string | RegExp) {
    // Match the actual error styling from Login.tsx
    const errorElement = this.page.locator('[role="alert"], .error, .text-red-500, .text-red-600').first();
    await expect(errorElement).toBeVisible();

    if (message) {
      await expect(errorElement).toContainText(message);
    }
  }

  async expectToBeOnLoginPage() {
    await expect(this.page).toHaveURL(/\/login/);
  }
}
