/**
 * Pictionary E2E helpers — seed games + their child teams via the aepbase
 * REST API.
 */

import { aepCreate, aepList, aepRemove } from '../../../../../tests/e2e/utils/aepbase-helpers';

export interface CreatePictionaryTeamInput {
  players: string[];
  won?: boolean;
  rank?: number;
}

export interface CreatePictionaryGameInput {
  played_at?: string;
  location?: string;
  winning_word?: string;
  notes?: string;
  teams: CreatePictionaryTeamInput[];
}

export interface PictionaryGameRecord {
  id: string;
  played_at: string;
  location?: string;
  winning_word?: string;
  notes?: string;
}

export interface PictionaryTeamRecord {
  id: string;
  players: string[];
  won?: boolean;
  rank?: number;
}

export async function createPictionaryGame(
  token: string,
  data: CreatePictionaryGameInput,
): Promise<{
  game: PictionaryGameRecord;
  teams: PictionaryTeamRecord[];
}> {
  const game = await aepCreate<PictionaryGameRecord>(
    token,
    'pictionary-games',
    {
      played_at: data.played_at || new Date().toISOString(),
      location: data.location,
      winning_word: data.winning_word,
      notes: data.notes,
    },
  );
  const teams: PictionaryTeamRecord[] = [];
  for (let i = 0; i < data.teams.length; i++) {
    const team = data.teams[i];
    const created = await aepCreate<PictionaryTeamRecord>(
      token,
      'pictionary-teams',
      {
        players: team.players,
        won: team.won ?? false,
        rank: team.rank ?? i + 1,
      },
      ['pictionary-games', game.id],
    );
    teams.push(created);
  }
  return { game, teams };
}

export async function deleteAllPictionaryGames(token: string) {
  const items = await aepList<{ id: string }>(token, 'pictionary-games');
  for (const item of items) {
    await aepRemove(token, 'pictionary-games', item.id, undefined, true);
  }
}
