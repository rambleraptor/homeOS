/**
 * Add a recipe's ingredients to the household grocery list.
 *
 * Bridges the recipes app to the separate groceries app: it reuses the
 * groceries' create + list hooks (both apps live in the same package, so the
 * import is a relative one) and layers the recipe-specific rules on top —
 * each grocery item is named after the ingredient alone, its quantity/unit go
 * into `notes`, and ingredients already on the list are skipped.
 */

import { useCreateGroceryItem } from '../../groceries/hooks/useCreateGroceryItem';
import { useGroceries } from '../../groceries/hooks/useGroceries';
import { decimalToFraction } from '@rambleraptor/homestead-core/shared/utils/fractionUtils';
import type { GroceryItemFormData } from '../../groceries/types';
import type { RecipeIngredient } from '../types';

export interface AddIngredientsResult {
  /** Number of new grocery items created. */
  added: number;
  /** Ingredients skipped because a matching name was already on the list. */
  skipped: number;
}

/** Format an ingredient's quantity + unit for the grocery item's notes ("2 cups"). */
export function ingredientNotes(ing: RecipeIngredient): string {
  const qty = ing.qty > 0 ? decimalToFraction(ing.qty) : '';
  const unit = ing.unit?.trim() ?? '';
  return [qty, unit].filter(Boolean).join(' ');
}

/**
 * Decide which ingredients become new grocery items. Blank ingredients are
 * ignored, and any ingredient whose name (case-insensitively) already exists
 * on the list — or was already queued earlier in this batch — is skipped.
 */
export function planGroceryAdditions(
  ingredients: RecipeIngredient[],
  existingNames: Iterable<string>,
): { toCreate: GroceryItemFormData[]; added: number; skipped: number } {
  const seen = new Set<string>();
  for (const name of existingNames) seen.add(name.trim().toLowerCase());

  const toCreate: GroceryItemFormData[] = [];
  let skipped = 0;

  for (const ing of ingredients) {
    const name = (ing.item || ing.raw || '').trim();
    if (!name) continue; // nothing usable to name the item — ignore silently

    const key = name.toLowerCase();
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);

    const notes = ingredientNotes(ing);
    toCreate.push(notes ? { name, notes } : { name });
  }

  return { toCreate, added: toCreate.length, skipped };
}

export function useAddIngredientsToGroceryList() {
  const { data: groceries } = useGroceries();
  const createMutation = useCreateGroceryItem();

  const addIngredients = (ingredients: RecipeIngredient[]): AddIngredientsResult => {
    const existingNames = (groceries ?? []).map((item) => item.name);
    const { toCreate, added, skipped } = planGroceryAdditions(ingredients, existingNames);

    // Fire-and-forget, mirroring the groceries app's optimistic quick-add:
    // each create inserts its row into the cache immediately via `onMutate`.
    for (const payload of toCreate) {
      createMutation.mutate(payload);
    }

    return { added, skipped };
  };

  return { addIngredients, isPending: createMutation.isPending };
}
