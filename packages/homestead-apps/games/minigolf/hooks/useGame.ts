/**
 * Single game hook. Reads one game by id.
 */

import { useResourceItem } from '@rambleraptor/homestead-core/api/resourceHooks';
import { GAMES } from '../resources';
import type { Game } from '../types';

export function useGame(gameId: string | null) {
  return useResourceItem<Game>('minigolf', 'game', GAMES, gameId);
}
