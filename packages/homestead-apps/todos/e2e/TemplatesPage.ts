/**
 * Templates Page Object Model — the dedicated /todos/templates screen where
 * list templates and their items are managed.
 */

import { Page, expect, Locator } from '@playwright/test';

export class TemplatesPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/todos/templates');
    await this.page
      .getByTestId('templates-add-input')
      .waitFor({ state: 'visible' });
  }

  private cardFor(name: string): Locator {
    return this.page
      .locator('[data-testid^="template-card-"]')
      .filter({ hasText: name })
      .first();
  }

  async createTemplate(name: string) {
    await this.page.getByTestId('templates-add-input').fill(name);
    await this.page.getByTestId('templates-add-submit').click();
    await this.cardFor(name).waitFor({ state: 'visible' });
  }

  async addItem(templateName: string, title: string) {
    const card = this.cardFor(templateName);
    await card.locator('input[placeholder="Add an item"]').fill(title);
    await card.getByRole('button', { name: 'Add item' }).click();
    await expect(card.getByText(title, { exact: true })).toBeVisible();
  }

  async removeItem(templateName: string, title: string) {
    const card = this.cardFor(templateName);
    await card
      .getByRole('button', { name: `Remove ${title}` })
      .click();
  }

  async addCategory(templateName: string, name: string) {
    const card = this.cardFor(templateName);
    await card.getByPlaceholder('Add a category').fill(name);
    await card.getByRole('button', { name: 'Add category' }).click();
    await expect(card.getByText(name, { exact: true })).toBeVisible();
  }

  async addItemInCategory(
    templateName: string,
    title: string,
    categoryName: string,
  ) {
    const card = this.cardFor(templateName);
    await card
      .getByRole('combobox', { name: 'Category for new item' })
      .selectOption({ label: categoryName });
    await card.locator('input[placeholder="Add an item"]').fill(title);
    await card.getByRole('button', { name: 'Add item' }).click();
    await expect(card.getByText(title, { exact: true })).toBeVisible();
  }

  async createListFrom(templateName: string) {
    await this.cardFor(templateName)
      .getByRole('button', { name: `Create a list from ${templateName}` })
      .click();
  }

  async deleteTemplate(templateName: string) {
    await this.cardFor(templateName)
      .getByRole('button', { name: `Delete template ${templateName}` })
      .click();
    await this.page.getByRole('button', { name: 'Delete' }).click();
  }

  async expectItem(templateName: string, title: string) {
    await expect(
      this.cardFor(templateName).getByText(title, { exact: true }),
    ).toBeVisible();
  }

  async expectItemAbsent(templateName: string, title: string) {
    await expect(
      this.cardFor(templateName).getByText(title, { exact: true }),
    ).toHaveCount(0);
  }

  async expectTemplateAbsent(templateName: string) {
    await expect(this.cardFor(templateName)).toHaveCount(0);
  }
}
