/**
 * Todos Page Object Model
 */

import { Page, expect, Locator } from '@playwright/test';

export class TodosPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/todos');
    await this.page.getByTestId('todos-add-input').waitFor({ state: 'visible' });
  }

  /**
   * Add a todo. On the main view two buttons are offered (personal is the
   * default); in a project view only the single family button exists. `kind`
   * selects the button on the main view and is ignored in a project view.
   */
  async addTodo(title: string, kind: 'personal' | 'family' = 'personal') {
    const input = this.page.getByTestId('todos-add-input');
    await input.fill(title);
    const personalBtn = this.page.getByTestId('todos-add-submit-personal');
    if ((await personalBtn.count()) > 0) {
      const id =
        kind === 'family'
          ? 'todos-add-submit-family'
          : 'todos-add-submit-personal';
      await this.page.getByTestId(id).click();
    } else {
      await this.page.getByTestId('todos-add-submit').click();
    }
    await expect(input).toHaveValue('');
  }

  async addPersonalTodo(title: string) {
    await this.addTodo(title, 'personal');
  }

  async addFamilyTodo(title: string) {
    await this.addTodo(title, 'family');
  }

  private async rowTestId(title: string): Promise<string> {
    const row = this.rowFor(title);
    await row.waitFor({ state: 'visible' });
    const testId = await row.getAttribute('data-testid');
    if (!testId) throw new Error(`Row for "${title}" missing testid`);
    return testId;
  }

  async expectFamilyMarker(title: string) {
    const testId = await this.rowTestId(title);
    await expect(this.page.getByTestId(`${testId}-family`)).toBeVisible();
  }

  async expectNoFamilyMarker(title: string) {
    const testId = await this.rowTestId(title);
    await expect(this.page.getByTestId(`${testId}-family`)).toHaveCount(0);
  }

  // --- Categories (project view) ---

  /** Expand the (collapsed-by-default) category manager panel if needed. */
  async openCategoryManager() {
    const toggle = this.page.getByTestId('todos-category-manager-toggle');
    if ((await toggle.getAttribute('aria-expanded')) === 'false') {
      await toggle.click();
    }
  }

  async addCategory(name: string) {
    await this.openCategoryManager();
    await this.page.getByTestId('todos-category-add-input').fill(name);
    await this.page.getByTestId('todos-category-add-submit').click();
    await expect(
      this.page.getByTestId('todos-category-list').getByText(name, {
        exact: true,
      }),
    ).toBeVisible();
  }

  /** Choose the category new todos are added into ('' clears to Uncategorized). */
  async selectAddCategory(name: string) {
    await this.page
      .getByTestId('todos-add-category')
      .selectOption({ label: name });
  }

  async deleteCategory(name: string) {
    await this.openCategoryManager();
    const item = this.page
      .locator('[data-testid^="todos-category-item-"]')
      .filter({ hasText: name })
      .first();
    await item.getByRole('button', { name: `Delete category ${name}` }).click();
  }

  private categoryGroup(name: string): Locator {
    return this.page
      .locator('[data-testid^="todos-category-group-"]')
      .filter({ hasText: name })
      .first();
  }

  async expectCategoryGroupVisible(name: string) {
    await expect(this.categoryGroup(name)).toBeVisible();
  }

  /** The named todo appears inside the group whose header is `categoryName`. */
  async expectTodoInGroup(categoryName: string, title: string) {
    await expect(
      this.categoryGroup(categoryName).getByText(title, { exact: true }),
    ).toBeVisible();
  }

  private rowFor(title: string) {
    return this.page
      .locator('[data-testid^="todo-row-"]')
      .filter({ hasText: title })
      .first();
  }

  private async clickRowAction(title: string, action: string) {
    const row = this.rowFor(title);
    await row.waitFor({ state: 'visible' });
    const testId = await row.getAttribute('data-testid');
    if (!testId) throw new Error(`Row for "${title}" missing testid`);
    await this.page.getByTestId(`${testId}-${action}`).click();
  }

  async markComplete(title: string) {
    await this.clickRowAction(title, 'complete');
  }

  async moveToDoLater(title: string) {
    await this.clickRowAction(title, 'dolater');
  }

  async cancel(title: string) {
    await this.clickRowAction(title, 'cancel');
  }

  async undo(title: string) {
    await this.clickRowAction(title, 'undo');
  }

  async selectMainProject() {
    await this.page.getByTestId('todos-project-pill-main').click();
  }

  async selectProject(name: string) {
    await this.page
      .getByTestId(/^todos-project-pill-/)
      .filter({ hasText: name })
      .first()
      .click();
  }

  async createProject(name: string) {
    await this.page.getByTestId('todos-project-add').click();
    await this.page.getByTestId('todos-project-name-input').fill(name);
    await this.page.getByTestId('todos-project-create-submit').click();
    // After create, the new project becomes active; wait for its pill.
    await this.page
      .getByTestId(/^todos-project-pill-/)
      .filter({ hasText: name })
      .first()
      .waitFor({ state: 'visible' });
  }

  async createListFromTemplate(templateName: string) {
    await this.page.getByTestId('todos-template-picker').click();
    await this.page
      .getByTestId('todos-template-menu')
      .getByText(templateName, { exact: true })
      .click();
  }

  async gotoTemplates() {
    await this.page.getByTestId('todos-templates-link').click();
  }

  /**
   * Delete the active project. By default its todos move to Main; pass
   * `{ deleteTodos: true }` to remove the list's todos outright instead.
   */
  async deleteCurrentProject(opts: { deleteTodos?: boolean } = {}) {
    await this.page
      .locator('[data-testid^="todos-project-delete-"]')
      .first()
      .click();
    if (opts.deleteTodos) {
      await this.page.getByTestId('todos-project-delete-todos').check();
    }
    await this.page.getByRole('button', { name: 'Delete' }).click();
  }

  async pinToMain(title: string) {
    await this.clickRowAction(title, 'pin');
  }

  async unpinFromMain(title: string) {
    await this.clickRowAction(title, 'pin');
  }

  async expectRowVisible(title: string) {
    await expect(this.rowFor(title)).toBeVisible();
  }

  async expectRowAbsent(title: string) {
    await expect(this.rowFor(title)).toHaveCount(0);
  }

  async expectProjectPillAbsent(projectId: string) {
    await expect(
      this.page.getByTestId(`todos-project-pill-${projectId}`),
    ).toHaveCount(0);
  }

  async expectInActive(title: string) {
    const section = this.page.getByTestId('todos-section-active');
    await expect(section.getByText(title).first()).toBeVisible();
  }

  async expectInDoLater(title: string) {
    const section = this.page.getByTestId('todos-section-dolater');
    await expect(section.getByText(title).first()).toBeVisible();
  }

  async expectInCompleted(title: string) {
    const toggle = this.page.getByTestId('todos-section-completed-toggle');
    if ((await toggle.getAttribute('aria-expanded')) === 'false') {
      await toggle.click();
    }
    const section = this.page.getByTestId('todos-section-completed');
    await expect(section.getByText(title).first()).toBeVisible();
  }

  async expectGreenSegmentNonZero() {
    const green = this.page.getByTestId('todos-progress-green');
    await expect(green).toBeVisible();
    const width = await green.evaluate(
      (el) => (el as HTMLElement).style.width || '0%',
    );
    if (width === '0%' || width === '') {
      throw new Error(`Expected green segment width > 0, got "${width}"`);
    }
  }

  async expectGreenSegmentZero() {
    const green = this.page.getByTestId('todos-progress-green');
    const width = await green.evaluate(
      (el) => (el as HTMLElement).style.width || '0%',
    );
    expect(width).toBe('0%');
  }
}
