import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { RECIPES } from '../resources';

export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await aepbase.remove(RECIPES, id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.module('recipes').all(),
      });
      await queryClient.refetchQueries({
        queryKey: queryKeys.module('recipes').all(),
      });
    },
  });
}
