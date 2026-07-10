/**
 * Minigolf E2E helpers — seed games (plural collection) via the aepbase
 * REST API.
 */

import { aepCreate, aepList, aepRemove } from '../../../../../tests/e2e/utils/aepbase-helpers';

interface CreateGameInput {
  /** Player resource paths: `["people/{id}", ...]`. */
  players: string[];
  hole_count: number;
  location?: string;
  played_at?: string;
  completed?: boolean;
}

export interface GameRecord {
  id: string;
  players: string[];
  hole_count: number;
  location?: string;
  played_at?: string;
  completed?: boolean;
}

export async function createGame(
  token: string,
  data: CreateGameInput,
): Promise<GameRecord> {
  return aepCreate<GameRecord>(token, 'games', {
    players: data.players,
    hole_count: data.hole_count,
    location: data.location,
    played_at: data.played_at || new Date().toISOString(),
    completed: data.completed ?? false,
  });
}

export async function deleteAllGames(token: string) {
  const items = await aepList<{ id: string }>(token, 'games');
  for (const item of items) {
    await aepRemove(token, 'games', item.id, undefined, true);
  }
}
