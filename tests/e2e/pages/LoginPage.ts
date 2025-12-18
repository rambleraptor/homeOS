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
    // Find the error container and then the text element inside it
    // The structure is: div > (SVG icon + p tag with text)
    const errorContainer = this.page.locator('.bg-red-50.border-red-200').first();
    await expect(errorContainer).toBeVisible();

    if (message) {
      // Find the p tag with the actual error text
      const errorText = errorContainer.locator('p.text-red-600');
      await expect(errorText).toContainText(message);
    }
  }

  async expectToBeOnLoginPage() {
    await expect(this.page).toHaveURL(/\/login/);
  }
}
