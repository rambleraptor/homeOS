/**
 * Holes list hook. Holes live at `/minigolf-games/{gameId}/minigolf-holes` — parent id is
 * part of the URL, not a stored field.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { GAMES, GAME_HOLES } from '../resources';
import type { Hole } from '../types';

export function useGameHoles(gameId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.app('minigolf').all(), 'holes', gameId || ''],
    queryFn: async (): Promise<Hole[]> => {
      if (!gameId) return [];
      const holes = await aepbase.list<Hole>(GAME_HOLES, {
        parent: [GAMES, gameId],
      });
      return holes.sort((a, b) => a.hole_number - b.hole_number);
    },
    enabled: !!gameId,
  });
}
