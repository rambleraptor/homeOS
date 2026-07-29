/**
 * Resolve a recipe's `image` file field to a blob URL the browser can render.
 * Thin wrapper over the shared `useFileFieldUrl`.
 */

import { useFileFieldUrl } from '@rambleraptor/homestead-core/api/resourceHooks';
import { RECIPES } from '../resources';
import type { Recipe } from '../types';

export function useRecipeImageUrl(
  recipe: Recipe | null | undefined,
): string | null {
  return useFileFieldUrl(RECIPES, recipe?.id, 'image', recipe?.image);
}
