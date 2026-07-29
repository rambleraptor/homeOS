/**
 * Single Pictionary game by id.
 */

import { useResourceItem } from '@rambleraptor/homestead-core/api/resourceHooks';
import { PICTIONARY_GAMES } from '../resources';
import type { PictionaryGame } from '../types';

export function useGame(gameId: string | null) {
  return useResourceItem<PictionaryGame>('pictionary', PICTIONARY_GAMES, gameId);
}
