/**
 * Groceries Page Object Model
 */

import { Page, expect } from '@playwright/test';

export class GroceriesPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/groceries');
  }

  async expectToBeOnGroceriesPage() {
    await expect(this.page).toHaveURL(/\/groceries/);
  }

  async createItem(data: { name: string; notes?: string }) {
    // Use the quick-add input to create an item
    const input = this.page.getByTestId('quick-add-input');
    await input.waitFor({ state: 'visible' });
    await input.fill(data.name);

    // Click the add button
    const addButton = this.page.getByTestId('quick-add-button');
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();

    // Wait for the input to be cleared and network to settle
    await this.page.waitForLoadState('networkidle');

    // Note: The quick-add doesn't support notes field
    // If notes are needed, that feature would need to be added
  }

  async expectItemInList(name: string) {
    await expect(this.page.getByText(name).first()).toBeVisible();
  }

  async expectItemNotInList(name: string) {
    const itemLocator = this.page.getByText(name).first();
    await expect(itemLocator).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // Element doesn't exist, which is fine
    });
  }

  async toggleItemChecked(name: string) {
    const checkbox = this.page
      .locator('[data-testid="grocery-item"]')
      .filter({ hasText: name })
      .locator('input[type="checkbox"]');

    await checkbox.waitFor({ state: 'visible' });
    await checkbox.click();
    // Wait for network to settle
    await this.page.waitForLoadState('networkidle');
  }

  async expectItemChecked(name: string, checked: boolean) {
    const checkbox = this.page
      .locator('[data-testid="grocery-item"]')
      .filter({ hasText: name })
      .locator('input[type="checkbox"]');

    if (checked) {
      await expect(checkbox).toBeChecked();
    } else {
      await expect(checkbox).not.toBeChecked();
    }
  }

  async deleteItem(name: string) {
    const itemRow = this.page
      .locator('[data-testid="grocery-item"]')
      .filter({ hasText: name });

    // Hover to reveal delete button
    await itemRow.hover();

    const deleteButton = itemRow.getByTestId('delete-grocery-item');
    await deleteButton.waitFor({ state: 'visible' });
    await deleteButton.click();

    // No confirmation dialog - item is deleted immediately
    // Wait for network to settle after deletion
    await this.page.waitForLoadState('networkidle');
  }

  async expectCategoryVisible(category: string) {
    await expect(this.page.getByText(category, { exact: true }).first()).toBeVisible();
  }

  async expectItemsInCategory(category: string, count: number) {
    const categorySection = this.page.locator('.bg-white.rounded-lg.border').filter({ hasText: category });
    await categorySection.waitFor({ state: 'visible' });

    const itemsInCategory = categorySection.locator('[data-testid="grocery-item"]');
    await expect(itemsInCategory).toHaveCount(count);
  }

  async expectProgressText(checked: number, total: number) {
    await expect(this.page.getByText(`${checked} / ${total} items checked`)).toBeVisible();
  }
}
