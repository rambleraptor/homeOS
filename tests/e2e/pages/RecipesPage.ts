/**
 * Recipes Page Object Model
 */

import { Page, expect } from '@playwright/test';

export interface RecipeFormInput {
  title: string;
  source_pointer?: string;
  method?: string;
  tags?: string[];
  ingredients: Array<{
    item: string;
    qty: number;
    unit: string;
    raw?: string;
  }>;
}

export class RecipesPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/recipes');
  }

  async expectToBeOnRecipesPage() {
    await expect(this.page).toHaveURL(/\/recipes/);
  }

  async clickAddRecipe() {
    const addButton = this.page.getByTestId('add-recipe-button');
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();
  }

  /** Fill the form for a brand-new recipe. Adds extra ingredient rows as needed. */
  async fillRecipeForm(data: RecipeFormInput) {
    await this.page.locator('#title').fill(data.title);

    if (data.source_pointer) {
      await this.page.locator('#source_pointer').fill(data.source_pointer);
    }

    // Form starts with one empty ingredient row. Add more as needed.
    for (let i = 1; i < data.ingredients.length; i++) {
      await this.page.getByTestId('add-ingredient-button').click();
    }

    for (let i = 0; i < data.ingredients.length; i++) {
      const ing = data.ingredients[i];
      await this.page.getByTestId(`ingredient-qty-${i}`).fill(String(ing.qty));
      await this.page.getByTestId(`ingredient-unit-${i}`).fill(ing.unit);
      await this.page.getByTestId(`ingredient-item-${i}`).fill(ing.item);
    }

    if (data.method) {
      await this.page.locator('#method').fill(data.method);
    }
    if (data.tags && data.tags.length > 0) {
      await this.page.locator('#tags').fill(data.tags.join(', '));
    }
  }

  async submitRecipeForm() {
    const submit = this.page.getByTestId('recipe-form-submit');
    await submit.waitFor({ state: 'visible' });
    await submit.click();
    await submit.waitFor({ state: 'hidden' });
  }

  async createRecipe(data: RecipeFormInput) {
    await this.clickAddRecipe();
    await this.fillRecipeForm(data);
    await this.submitRecipeForm();
    await this.page.waitForLoadState('networkidle');
  }

  async clickEdit(title: string) {
    const btn = this.page.getByTestId(`recipe-edit-${title}`);
    await btn.waitFor({ state: 'visible' });
    await btn.click();
  }

  async clickDelete(title: string) {
    const btn = this.page.getByTestId(`recipe-delete-${title}`);
    await btn.waitFor({ state: 'visible' });
    await btn.click();
    const confirm = this.page.getByRole('button', { name: /^delete$/i });
    await confirm.waitFor({ state: 'visible' });
    await confirm.click();
    await this.page.waitForLoadState('networkidle');
  }

  /** Edit just the title of an existing recipe. */
  async editRecipeTitle(currentTitle: string, newTitle: string) {
    await this.clickEdit(currentTitle);
    await this.page.locator('#title').waitFor({ state: 'visible' });
    await this.page.locator('#title').fill(newTitle);
    await this.submitRecipeForm();
    await this.page.waitForLoadState('networkidle');
  }

  async expectRecipeInList(title: string) {
    await expect(this.page.getByTestId(`recipe-row-${title}`)).toBeVisible();
  }

  async expectRecipeNotInList(title: string) {
    await expect(this.page.getByTestId(`recipe-row-${title}`)).toHaveCount(0);
  }

  async expectEmptyState() {
    await expect(this.page.getByTestId('recipes-empty-state')).toBeVisible();
  }

  async expectSidebarLinkVisible() {
    await expect(
      this.page.getByRole('link', { name: 'Recipes' }),
    ).toBeVisible();
  }

  async expectSidebarLinkHidden() {
    await expect(
      this.page.getByRole('link', { name: 'Recipes' }),
    ).toHaveCount(0);
  }
}
