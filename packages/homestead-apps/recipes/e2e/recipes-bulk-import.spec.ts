/**
 * Recipes bulk import E2E.
 *
 * Recipes is the multi-format case: pasted text and Paprika archives, both
 * behind the same `recipes:bulk-import` verb.
 *
 * Everything runs as the superuser, matching the other recipes specs: the app's
 * `enabled` flag defaults to 'superusers', so a regular user is gated out of
 * writing recipes at all.
 */

import { test, expect } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import { e2eClient, listOrEmpty, postCustomMethod } from '../../../../tests/e2e/utils/aepbase-helpers';
import { deleteAllRecipes, type RecipeRecord } from './helpers';

interface OperationRow {
  id: string;
  done: boolean;
  response?: {
    dryRun: boolean;
    created?: number;
    items?: Array<{ index: number; label?: string; errors: string[] }>;
    summary: { total: number; valid: number; invalid: number };
  };
  error?: { message?: string };
}

const RECIPE_TEXT = [
  'Bacon Wrapped Asparagus',
  '',
  'Ingredients:',
  '1 pound asparagus, trimmed',
  '8 strips thick-cut bacon',
  '',
  'Directions:',
  'Preheat the oven to 400 degrees F.',
  'Bake until the bacon is crisp.',
  '',
  'Source: https://www.wellplated.com/bacon-wrapped-asparagus/',
].join('\n');

const paprikaJson = (name: string) => ({
  name,
  source: 'wellplated.com',
  source_url: 'https://example.com/recipe',
  ingredients: '1 pound asparagus spears trimmed\n1 tablespoon extra-virgin olive oil',
  directions: 'Preheat the oven.\n\nBake until crisp.',
  prep_time: '10 mins',
  cook_time: '25 mins',
  servings: '4 servings',
  categories: ['Sides'],
});

/** Gzip a string the way a real `.paprikarecipe` file is encoded. */
async function gzip(text: string): Promise<Buffer> {
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  const buf = await new Response(source.pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return Buffer.from(buf);
}

async function bulkImport(
  token: string,
  body: Record<string, unknown>,
): Promise<OperationRow> {
  const res = await postCustomMethod(token, '/recipes:bulk-import', body);
  expect(res.status).toBe(202);
  const { id } = (await res.json()) as { id: string };

  await expect
    .poll(async () => (await e2eClient(token).collection<OperationRow>('operations').get(id)).done, {
      timeout: 15_000,
    })
    .toBe(true);
  return e2eClient(token).collection<OperationRow>('operations').get(id);
}

test.describe('Recipes bulk import — API', () => {
  test.beforeEach(async ({ adminToken }) => {
    await deleteAllRecipes(adminToken);
  });

  test('imports a recipe pasted as text', async ({ adminToken }) => {
    const operation = await bulkImport(adminToken, { format: 'text', text: RECIPE_TEXT });

    expect(operation.response?.created).toBe(1);
    const recipes = await listOrEmpty<RecipeRecord>(adminToken, 'recipes');
    expect(recipes).toHaveLength(1);
    expect(recipes[0].title).toBe('Bacon Wrapped Asparagus');
    expect(recipes[0].parsed_ingredients.length).toBeGreaterThan(0);
    expect(recipes[0].steps?.length).toBeGreaterThan(0);
  });

  test('imports a gzipped Paprika recipe', async ({ adminToken }) => {
    const file = await gzip(JSON.stringify(paprikaJson('Bacon Wrapped Asparagus')));
    const operation = await bulkImport(adminToken, {
      format: 'paprika',
      data: file.toString('base64'),
      filenames: ['asparagus.paprikarecipe'],
    });

    expect(operation.response?.created).toBe(1);
    const recipes = await listOrEmpty<RecipeRecord>(adminToken, 'recipes');
    expect(recipes[0].title).toBe('Bacon Wrapped Asparagus');
    expect(recipes[0].prep_time).toBe('10 mins');
  });

  test('imports several Paprika files in one call', async ({ adminToken }) => {
    const [a, b] = await Promise.all([
      gzip(JSON.stringify(paprikaJson('Recipe A'))),
      gzip(JSON.stringify(paprikaJson('Recipe B'))),
    ]);

    const operation = await bulkImport(adminToken, {
      format: 'paprika',
      data: [a.toString('base64'), b.toString('base64')],
      filenames: ['a.paprikarecipe', 'b.paprikarecipe'],
    });

    expect(operation.response?.created).toBe(2);
    const recipes = await listOrEmpty<RecipeRecord>(adminToken, 'recipes');
    expect(recipes.map((r) => r.title).sort()).toEqual(['Recipe A', 'Recipe B']);
  });

  test('one unreadable file does not stop its siblings importing', async ({ adminToken }) => {
    // The whole point of reporting problems per item rather than throwing.
    const good = await gzip(JSON.stringify(paprikaJson('Recipe A')));
    const operation = await bulkImport(adminToken, {
      format: 'paprika',
      data: [Buffer.from('not a paprika file').toString('base64'), good.toString('base64')],
      filenames: ['broken.paprikarecipe', 'good.paprikarecipe'],
      dryRun: true,
    });

    expect(operation.response?.summary).toEqual({ total: 2, valid: 1, invalid: 1 });
    const broken = operation.response?.items?.find((i) => i.errors.length > 0);
    // The error names the file it came from — "1 of 2 failed" isn't actionable
    // otherwise.
    expect(broken?.errors[0]).toContain('broken.paprikarecipe');
  });

  test('advertises every format for discovery', async ({ request }) => {
    const res = await request.get('/api/custom-methods');
    const { methods } = (await res.json()) as {
      methods: Array<{
        plural: string;
        verb: string;
        bulkImport?: {
          formats: Array<{ id: string; inputType: string; multiple: boolean }>;
        };
      }>;
    };

    const formats = methods.find((m) => m.plural === 'recipes' && m.verb === 'bulk-import')
      ?.bulkImport?.formats;
    // Order matters: the import page selects the first format by default.
    expect(formats?.map((f) => f.id)).toEqual(['url', 'text', 'paprika']);
    expect(formats?.find((f) => f.id === 'url')?.inputType).toBe('text');
    expect(formats?.find((f) => f.id === 'text')?.inputType).toBe('text');
    expect(formats?.find((f) => f.id === 'paprika')?.multiple).toBe(true);
  });
});

test.describe('Recipes bulk import — page', () => {
  test.beforeEach(async ({ adminToken }) => {
    await deleteAllRecipes(adminToken);
  });

  test('imports pasted text through the standardized page', async ({
    authenticatedAdminPage: authenticatedPage,
    adminToken,
  }) => {
    // Import used to be a modal; it has its own route now, like every other app.
    await authenticatedPage.goto('/recipes');
    await authenticatedPage.getByTestId('import-recipe-button').click();
    await authenticatedPage.waitForURL(/\/recipes\/import$/);

    // URL is the first format, so it's the one selected by default. Pick the
    // text importer explicitly — both accept text input, so without this the
    // pasted recipe would be handed to the URL importer.
    await authenticatedPage.getByTestId('import-format-text').click();
    await authenticatedPage.getByTestId('import-text-input').fill(RECIPE_TEXT);
    await authenticatedPage.getByTestId('bulk-import-preview-button').click();

    // Assert against the preview row, not the page: the pasted text is still
    // sitting in the textarea, so a bare getByText matches even on no preview.
    await expect(
      authenticatedPage
        .getByTestId('recipe-import-preview-row')
        .filter({ hasText: 'Bacon Wrapped Asparagus' }),
    ).toBeVisible();
    await authenticatedPage.getByTestId('import-button').click();
    await authenticatedPage.waitForURL(/\/recipes$/);

    const recipes = await listOrEmpty<RecipeRecord>(adminToken, 'recipes');
    expect(recipes.map((r) => r.title)).toEqual(['Bacon Wrapped Asparagus']);
  });

  test('offers a format picker and switches to the Paprika file input', async ({
    authenticatedAdminPage: authenticatedPage,
  }) => {
    await authenticatedPage.goto('/recipes/import');

    // The picker is built from the server's format list, not client code.
    await expect(authenticatedPage.getByTestId('import-format-text')).toBeVisible();
    await expect(authenticatedPage.getByTestId('import-text-input')).toBeVisible();

    await authenticatedPage.getByTestId('import-format-paprika').click();
    await expect(authenticatedPage.getByTestId('bulk-import-file-input')).toBeAttached();
    await expect(authenticatedPage.getByTestId('import-text-input')).toHaveCount(0);
  });
});
