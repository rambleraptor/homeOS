/**
 * Delete a Pictionary game and its child teams (force-cascade — a game
 * always has teams, so a plain delete would 409).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { PICTIONARY_GAMES } from '../resources';

export function useDeleteGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await aepbase.remove(PICTIONARY_GAMES, id, { force: true });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.app('pictionary').all(),
      });
    },
  });
}
