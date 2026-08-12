/**
 * post_classify hook for the `recipe` doc type.
 *
 * When a document is classified as a recipe, create a matching record in the
 * Recipes app from the structured fields the classify pass already extracted
 * (ingredients, steps, times). The document's AI-inferred title becomes the
 * recipe's title.
 *
 * When the source document is itself a photo — someone's snapshot of a recipe
 * card or cookbook page, which shows the finished dish — its bytes are copied
 * onto the new recipe's `image` field so the Recipes app has a picture. See
 * {@link copyDocumentImage} for the (best-effort) mechanics and why a PDF
 * source is skipped.
 *
 * Server-only (`.server.ts`): the client build stubs this module, so its
 * cross-app import and the aepbase helper never reach the browser bundle. It is
 * only ever reached through the lazy `post_classify` thunk on the doc type.
 */

import { serverClient } from '@rambleraptor/homestead-core/server/client';
import type { PostClassifyHandler } from '../docType';
import { DOCUMENTS } from '../../resources';
import type { Document } from '../../types';
import { RECIPES } from '../../../recipes/resources';
import type { Recipe, RecipeIngredient } from '../../../recipes/types';

/**
 * MIME types the recipe `image` field can display. The documents pipeline only
 * accepts PDFs and these raster types (classify's `SUPPORTED_MIME`), and the
 * Recipes app renders `image` inline as an `<img>` — so only a raster source
 * can become a recipe photo.
 */
const DISPLAYABLE_IMAGE_MIME = /^image\/(jpeg|png|webp|gif)$/;

/**
 * Copy the source document's bytes onto the recipe's `image` field, so a recipe
 * captured as a photo carries that photo into the Recipes app.
 *
 * Best-effort by design, and deliberately a follow-up write rather than part of
 * the create: the recipe already exists by the time this runs, so a download or
 * upload that fails leaves the recipe intact (image is a nice-to-have, never a
 * reason to lose the parse) — the error is logged and swallowed.
 *
 * A PDF source is skipped: a PDF can't render as the recipe's `<img>`, and
 * lifting the embedded dish photo out of one would need an image pipeline this
 * app doesn't have. So the copy is scoped to documents that are themselves an
 * image — the "I took a picture of the recipe" case the field is here to serve.
 */
async function copyDocumentImage(
  document: Document,
  token: string,
  recipeId: string,
): Promise<void> {
  if (!document.mime_type || !DISPLAYABLE_IMAGE_MIME.test(document.mime_type)) {
    return;
  }
  try {
    const client = serverClient(token);
    const image = await client
      .collection<Document>(DOCUMENTS)
      .record(document.id)
      .download('file');
    await client.collection<Recipe>(RECIPES).record(recipeId).update({ image });
  } catch (err) {
    console.error(
      `[documents] copying recipe image from document ${document.id} failed`,
      err,
    );
  }
}

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

  // Prefer a printed source; otherwise point back at the originating document.
  recipeBody.source_pointer =
    asString(metadata.source_pointer) ?? `${DOCUMENTS}/${document.id}`;
  if (document.created_by) recipeBody.created_by = document.created_by;

  const created = await serverClient(auth.token).collection<Recipe>(RECIPES).create(recipeBody);
  await copyDocumentImage(document, auth.token, created.id);
  return { linked_resource: `${RECIPES}/${created.id}` };
};

export default handler;
