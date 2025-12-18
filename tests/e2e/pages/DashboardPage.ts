/**
 * Dashboard Page Object Model
 */

import { Page, expect } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard');
  }

  async expectToBeOnDashboard() {
    await expect(this.page).toHaveURL(/\/dashboard/);
  }

  async expectWelcomeMessage() {
    await expect(this.page.getByText(/welcome/i).or(this.page.getByRole('heading', { level: 1 }))).toBeVisible();
  }

  async logout() {
    // Look for logout button or user menu
    const logoutButton = this.page.getByRole('button', { name: /logout|sign out/i });
    await logoutButton.click();
  }

  async navigateToModule(moduleName: string | RegExp) {
    await this.page.getByRole('navigation').getByRole('link', { name: moduleName }).click();
  }
}
