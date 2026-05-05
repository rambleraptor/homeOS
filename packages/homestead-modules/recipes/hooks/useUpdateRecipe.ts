import { useResourceUpdate } from '@rambleraptor/homestead-core/api/resourceHooks';
import type { Recipe, RecipeFormData } from '../types';

export function useUpdateRecipe() {
  return useResourceUpdate<Recipe, RecipeFormData>('recipes', 'recipe');
}
