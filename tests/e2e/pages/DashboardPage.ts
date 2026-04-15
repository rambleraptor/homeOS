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
    // Use data-testid for reliable selection (preferred method)
    const logoutButton = this.page.getByTestId('logout-button');
    // Wait for the button to be attached + visible before clicking. The
    // sidebar mounts as soon as the shell renders, but giving this an
    // explicit auto-wait makes the failure mode more legible if it
    // regresses.
    await logoutButton.waitFor({ state: 'visible' });
    await logoutButton.scrollIntoViewIfNeeded();
    await logoutButton.click();
    // Wait for logout to redirect to the login page. The redirect is
    // driven by the AuthGuard's useEffect after auth state clears, so we
    // give it a generous budget in case dev-mode rebuilds are in flight.
    await this.page.waitForURL(/\/login/, { timeout: 15000 });
  }

  async navigateToModule(moduleName: string | RegExp) {
    await this.page.getByRole('navigation').getByRole('link', { name: moduleName }).click();
  }
}
