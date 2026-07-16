/**
 * Bridges the recipe importers (`../importers/`) to the bulk-import framework.
 *
 * An importer answers per *input* — one result carrying a recipe, its extra
 * recipes, and file-level errors. The framework wants per *record* — one item
 * per recipe, each carrying its own errors. This flattens the former into the
 * latter.
 *
 * Server-only: only reachable from the `methods/` modules the client build
 * stubs out.
 */

import type { ParsedItem } from '@rambleraptor/homestead-core/resources/bulk-import/types';
import type { RecipeImportResult } from '../importers/types';
import type { RecipeFormData } from '../types';

/** A recipe as it goes to the engine — importers never set `image`. */
export type RecipeImportData = Omit<RecipeFormData, 'image'>;

/**
 * Flatten importer results into items, one per recipe.
 *
 * A result that produced no recipe becomes a single errored item, so an
 * unreadable file surfaces in the preview instead of vanishing — and, because
 * items are selected independently, it can't stop the other files from
 * importing. (The old modal had to explicitly demote per-file fatal errors to
 * warnings to get that behaviour; per-item errors give it for free.)
 *
 * `label` is what the preview shows per row, so prefix it with the filename
 * when several files are in play — "3 of 40 recipes failed" is only actionable
 * if you can tell which file they came from.
 */
export function toParsedItems(
  results: RecipeImportResult[],
  filenames?: string[],
): ParsedItem<RecipeImportData>[] {
  const items: ParsedItem<RecipeImportData>[] = [];
  const multi = results.length > 1;

  results.forEach((result, i) => {
    const source = multi ? filenames?.[i] : undefined;
    const prefix = source ? `${source}: ` : '';
    const recipes = [result.data, ...(result.additional ?? [])].filter(
      (r): r is RecipeFormData => r !== undefined,
    );

    if (recipes.length === 0) {
      items.push({
        index: items.length,
        data: {} as RecipeImportData,
        errors: (result.errors.length > 0 ? result.errors : ['No recipes found']).map(
          (e) => `${prefix}${e}`,
        ),
        warnings: result.warnings.map((w) => `${prefix}${w}`),
        label: source ?? 'Import',
      });
      return;
    }

    for (const recipe of recipes) {
      const { image: _image, ...data } = recipe;
      items.push({
        index: items.length,
        data,
        errors: [],
        // Warnings are per-input, not per-recipe, so an archive's warnings
        // repeat across its recipes. That's the honest reading: they apply to
        // every recipe that came out of it.
        warnings: result.warnings.map((w) => `${prefix}${w}`),
        label: source ? `${source}: ${recipe.title}` : recipe.title,
      });
    }
  });

  return items;
}
