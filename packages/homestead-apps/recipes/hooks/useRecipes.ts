/**
 * Recipes Query Hook
 *
 * aepbase has no `sort` query param, so we order client-side by
 * `create_time` desc (newest first).
 */

import {
  useResourceList,
  byCreateTimeDesc,
} from '@rambleraptor/homestead-core/api/resourceHooks';
import { RECIPES } from '../resources';
import type { Recipe } from '../types';

export function useRecipes() {
  return useResourceList<Recipe>('recipes', 'recipe', RECIPES, {
    sort: byCreateTimeDesc,
  });
}
