import { useResourceCreate } from '@rambleraptor/homestead-core/api/resourceHooks';
import type { Recipe, RecipeFormData } from '../types';

export function useCreateRecipe() {
  return useResourceCreate<Recipe, RecipeFormData>('recipes', 'recipe');
}
