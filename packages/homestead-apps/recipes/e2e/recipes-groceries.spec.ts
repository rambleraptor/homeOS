/**
 * Recipes app — "Add to grocery list" E2E tests
 *
 * Covers the button on the recipe view page (`/recipes/{id}`) that pushes a
 * recipe's ingredients onto the household grocery list:
 *  - each ingredient lands as its own grocery item (named after the ingredient)
 *  - an ingredient already on the list is skipped (not duplicated)
 *
 * Recipes are seeded via REST; the resulting grocery list is verified via REST
 * (10-100x faster and more reliable than reading it back through the UI).
 */

import { test, expect } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import {
  aepCreate,
  aepList,
  aepRemove,
  resetAppFlags,
} from '../../../../tests/e2e/utils/aepbase-helpers';
import { RecipesPage } from './RecipesPage';
import { createRecipe, deleteAllRecipes } from './helpers';

interface GroceryRecord {
  id: string;
  name: string;
  notes?: string;
}

const recipe = {
  title: 'Weeknight Tacos',
  parsed_ingredients: [
    { item: 'ground beef', qty: 1, unit: 'lb', raw: '1 lb ground beef' },
    { item: 'tortillas', qty: 8, unit: 'whole', raw: '8 tortillas' },
    { item: 'cheddar cheese', qty: 2, unit: 'cups', raw: '2 cups cheddar cheese' },
  ],
};

async function deleteAllGroceries(token: string) {
  const items = await aepList<{ id: string }>(token, 'groceries');
  for (const item of items) {
    await aepRemove(token, 'groceries', item.id, undefined, true);
  }
}

test.describe('Recipes → grocery list', () => {
  let recipesPage: RecipesPage;

  test.beforeEach(async ({ adminToken, authenticatedAdminPage }) => {
    await resetAppFlags(adminToken);
    await deleteAllRecipes(adminToken);
    await deleteAllGroceries(adminToken);
    recipesPage = new RecipesPage(authenticatedAdminPage);
  });

  test.afterEach(async ({ adminToken }) => {
    await deleteAllRecipes(adminToken);
    await deleteAllGroceries(adminToken);
    await resetAppFlags(adminToken);
  });

  test('adds all ingredients to the grocery list', async ({ adminToken }) => {
    const created = await createRecipe(adminToken, recipe);

    await recipesPage.gotoRecipe(created.id);
    await recipesPage.expectOnRecipeViewPage(created.id);

    await recipesPage.addIngredientsToGroceryList();

    await expect(async () => {
      const groceries = await aepList<GroceryRecord>(adminToken, 'groceries');
      const names = groceries.map((g) => g.name).sort();
      expect(names).toEqual(['cheddar cheese', 'ground beef', 'tortillas']);
    }).toPass();

    // Quantity + unit are carried into the item's notes.
    const groceries = await aepList<GroceryRecord>(adminToken, 'groceries');
    const beef = groceries.find((g) => g.name === 'ground beef');
    expect(beef?.notes).toBe('1 lb');
  });

  test('skips ingredients already on the grocery list', async ({ adminToken }) => {
    const created = await createRecipe(adminToken, recipe);
    // Pre-seed a matching item so it should not be added a second time.
    await aepCreate<GroceryRecord>(adminToken, 'groceries', { name: 'tortillas' });

    await recipesPage.gotoRecipe(created.id);
    await recipesPage.expectOnRecipeViewPage(created.id);

    await recipesPage.addIngredientsToGroceryList();

    await expect(async () => {
      const groceries = await aepList<GroceryRecord>(adminToken, 'groceries');
      const names = groceries.map((g) => g.name).sort();
      expect(names).toEqual(['cheddar cheese', 'ground beef', 'tortillas']);
    }).toPass();

    // Exactly one "tortillas" row — the pre-seeded one was not duplicated.
    const groceries = await aepList<GroceryRecord>(adminToken, 'groceries');
    expect(groceries.filter((g) => g.name === 'tortillas')).toHaveLength(1);
  });
});
