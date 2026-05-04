/**
 * Delete a Pictionary game. aepbase cascades child teams when the
 * parent is deleted.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { PICTIONARY_GAMES } from '../resources';

export function useDeleteGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await aepbase.remove(PICTIONARY_GAMES, id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.module('pictionary').all(),
      });
    },
  });
}
