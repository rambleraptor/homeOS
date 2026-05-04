/**
 * Delete Game Mutation Hook. Cascade-deletes child holes.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { GAMES } from '../resources';

export function useDeleteGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await aepbase.remove(GAMES, id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.module('minigolf').all(),
      });
    },
  });
}
