/**
 * Recipes module — view-detail E2E tests
 *
 * Covers the read-only "cooking mode" page at `/recipes/{id}`:
 *  - rendering a recipe seeded via REST (title, ingredients, steps,
 *    method notes, prep/cook/serving meta)
 *  - navigating from the list card into the view
 *  - returning to the list via the "Back to recipes" link
 *
 * Mirrors the CRUD spec's worker model: all data ops run with
 * `adminToken`, and UI interactions go through `authenticatedAdminPage`
 * so the Recipes module is visible regardless of the `enabled` flag.
 */

import { test, expect } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import { resetModuleFlags } from '../../../../tests/e2e/utils/aepbase-helpers';
import { RecipesPage } from './RecipesPage';
import { createRecipe, deleteAllRecipes } from './helpers';

const richRecipe = {
  title: 'Roast Chicken',
  source_pointer: 'https://example.com/roast-chicken',
  parsed_ingredients: [
    { item: 'whole chicken', qty: 1, unit: 'whole', raw: '1 whole chicken' },
    { item: 'kosher salt', qty: 2, unit: 'tsp', raw: '2 tsp kosher salt' },
    { item: 'lemon', qty: 1, unit: 'whole', raw: '1 lemon' },
  ],
  steps: [
    'Pat the chicken dry and season generously with salt.',
    'Stuff the cavity with the halved lemon.',
    'Roast at 425F for 50 minutes, then rest 10 minutes before carving.',
  ],
  method: 'Best served with pan drippings spooned over the top.',
  prep_time: '10 mins',
  cook_time: '50 mins',
  servings: '4',
  tags: ['dinner', 'poultry'],
};

test.describe('Recipes view', () => {
  let recipesPage: RecipesPage;

  test.beforeEach(async ({ adminToken, authenticatedAdminPage }) => {
    await resetModuleFlags(adminToken);
    await deleteAllRecipes(adminToken);
    recipesPage = new RecipesPage(authenticatedAdminPage);
  });

  test.afterEach(async ({ adminToken }) => {
    await deleteAllRecipes(adminToken);
    await resetModuleFlags(adminToken);
  });

  test('renders a seeded recipe at /recipes/{id}', async ({ adminToken }) => {
    const created = await createRecipe(adminToken, richRecipe);

    await recipesPage.gotoRecipe(created.id);

    await recipesPage.expectOnRecipeViewPage(created.id);
    await recipesPage.expectRecipeViewTitle(richRecipe.title);

    for (const ing of richRecipe.parsed_ingredients) {
      await recipesPage.expectRecipeViewIngredient(ing.item);
    }
    for (const step of richRecipe.steps) {
      await recipesPage.expectRecipeViewStep(step);
    }

    await recipesPage.expectRecipeViewMeta(richRecipe.prep_time);
    await recipesPage.expectRecipeViewMeta(richRecipe.cook_time);
    await recipesPage.expectRecipeViewMeta(richRecipe.servings);
    await recipesPage.expectRecipeViewMethod(richRecipe.method);
  });

  test('navigates from the list card into the recipe view', async ({
    adminToken,
  }) => {
    const created = await createRecipe(adminToken, richRecipe);

    await recipesPage.goto();
    await recipesPage.expectRecipeInList(richRecipe.title);

    await recipesPage.clickRecipeCard(richRecipe.title);

    await recipesPage.expectOnRecipeViewPage(created.id);
    await recipesPage.expectRecipeViewTitle(richRecipe.title);
  });

  test('"Back to recipes" returns to the list from the view', async ({
    adminToken,
    authenticatedAdminPage,
  }) => {
    const created = await createRecipe(adminToken, richRecipe);

    await recipesPage.gotoRecipe(created.id);
    await recipesPage.expectOnRecipeViewPage(created.id);

    await recipesPage.clickBackToRecipes();

    await expect(authenticatedAdminPage).toHaveURL(/\/recipes$/);
    await recipesPage.expectRecipeInList(richRecipe.title);
  });
});
