/**
 * post_classify hook for the `recipe` doc type.
 *
 * When a document is classified as a recipe, create a matching record in the
 * Recipes app from the structured fields the classify pass already extracted
 * (ingredients, steps, times). The document's AI-inferred title becomes the
 * recipe's title. Recipe's `image` field is optional, so a plain JSON create
 * suffices — no need to copy the document's file.
 *
 * Server-only (`.server.ts`): the client build stubs this module, so its
 * cross-app import and the aepbase helper never reach the browser bundle. It is
 * only ever reached through the lazy `post_classify` thunk on the doc type.
 */

import { aepCreate } from '@rambleraptor/homestead-core/server/aepbase';
import type { PostClassifyHandler } from '../docType';
import { DOCUMENTS } from '../../resources';
import { RECIPES } from '../../../recipes/resources';
import type { Recipe, RecipeIngredient } from '../../../recipes/types';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter((v): v is string => v !== undefined);
}

/**
 * Coerce the extracted ingredient list into the recipe resource's shape. The
 * model fills unfound sub-fields with null (the nullable schema), and `classify`
 * only strips top-level nulls — so drop the per-ingredient nulls here rather
 * than storing a `qty: null` the number column would reject.
 */
function asIngredients(value: unknown): Partial<RecipeIngredient>[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (v): v is Record<string, unknown> =>
        !!v && typeof v === 'object' && !Array.isArray(v),
    )
    .map((ing) => {
      const out: Partial<RecipeIngredient> = {};
      const item = asString(ing.item);
      const unit = asString(ing.unit);
      const raw = asString(ing.raw);
      const qty = asNumber(ing.qty);
      if (item) out.item = item;
      if (qty !== undefined) out.qty = qty;
      if (unit) out.unit = unit;
      if (raw) out.raw = raw;
      return out;
    })
    .filter((ing) => Object.keys(ing).length > 0);
}

const handler: PostClassifyHandler = async ({ document, metadata, auth }) => {
  const recipeBody: Record<string, unknown> = {
    // `title` and `parsed_ingredients` are the recipe resource's required fields.
    title: document.title?.trim() || 'Untitled recipe',
    parsed_ingredients: asIngredients(metadata.parsed_ingredients),
  };

  const steps = asStringArray(metadata.steps);
  if (steps.length) recipeBody.steps = steps;
  const tags = asStringArray(metadata.tags);
  if (tags.length) recipeBody.tags = tags;
  const method = asString(metadata.method);
  if (method) recipeBody.method = method;
  const prepTime = asString(metadata.prep_time);
  if (prepTime) recipeBody.prep_time = prepTime;
  const cookTime = asString(metadata.cook_time);
  if (cookTime) recipeBody.cook_time = cookTime;
  const servings = asString(metadata.servings);
  if (servings) recipeBody.servings = servings;

  // Link back to the originating document — drives cascade delete of this
  // recipe when the document is deleted.
  recipeBody.source_document = `${DOCUMENTS}/${document.id}`;
  // Keep any printed/URL source the model extracted (free-text, separate from
  // the document back-link).
  const sourcePointer = asString(metadata.source_pointer);
  if (sourcePointer) recipeBody.source_pointer = sourcePointer;
  if (document.created_by) recipeBody.created_by = document.created_by;

  const created = await aepCreate<Recipe>(RECIPES, recipeBody, auth.token);
  return { linked_resource: `${RECIPES}/${created.id}` };
};

export default handler;
