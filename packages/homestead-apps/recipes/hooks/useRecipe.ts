/**
 * Single Recipe Query Hook
 */

import { useResourceItem } from '@rambleraptor/homestead-core/api/resourceHooks';
import { RECIPES } from '../resources';
import type { Recipe } from '../types';

export function useRecipe(id: string | null) {
  return useResourceItem<Recipe>('recipes', 'recipe', RECIPES, id);
}
