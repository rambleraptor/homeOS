/**
 * Single Recipe Query Hook
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { RECIPES } from '../resources';
import type { Recipe } from '../types';

export function useRecipe(id: string | null) {
  return useQuery({
    queryKey: queryKeys.module('recipes').detail(id ?? ''),
    queryFn: async (): Promise<Recipe> => {
      if (!id) throw new Error('Recipe id is required');
      return aepbase.get<Recipe>(RECIPES, id);
    },
    enabled: !!id,
  });
}
