/**
 * Recipes Query Hook — newest first (`-create_time`), ordered server-side.
 */

import { useResourceList } from '@rambleraptor/homestead-core/api/resourceHooks';
import { RECIPES } from '../resources';
import type { Recipe } from '../types';

export function useRecipes() {
  return useResourceList<Recipe>('recipes', 'recipe', {
    plural: RECIPES,
    orderBy: '-create_time',
  });
}
