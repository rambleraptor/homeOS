import { useResourceDelete } from '@rambleraptor/homestead-core/api/resourceHooks';

export function useDeleteRecipe() {
  return useResourceDelete('recipes', 'recipe');
}
