/**
 * Pictionary CSV import — parser and saver.
 *
 * Server-only (under `methods/`, so the client build stubs it out).
 *
 * Layout: one row per game, with 4 game-level columns, 6 team columns
 * (`team_1`..`team_6`, the first two required, each a comma-separated list of
 * player names), and a `winner` column naming the winning team by its 1-based
 * position.
 *
 * Two things make this the framework's awkward case, and both are handled here
 * rather than by the app's UI:
 *  - Player names must resolve against the People collection, so the parser
 *    loads that map itself (it gets `ctx.auth`) instead of a page fetching it
 *    and passing it in.
 *  - One row becomes a game *plus* N team children, which is why it needs a
 *    saver rather than the default one-record-per-item create.
 */

import {
  createCsvParser,
  validateOptionalString,
  type CsvFieldConfig,
  type CsvSchema,
  type FieldValidator,
} from '@rambleraptor/homestead-core/server/bulk-import/csv';
import type {
  BulkImportContext,
  BulkImportParser,
  BulkImportSaveResult,
  BulkImportSaver,
} from '@rambleraptor/homestead-core/resources/bulk-import/types';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import { PEOPLE } from '../../../people/resources';
import { PICTIONARY_GAMES, PICTIONARY_TEAMS } from '../resources';

export const TEAM_COLUMNS = [
  'team_1',
  'team_2',
  'team_3',
  'team_4',
  'team_5',
  'team_6',
] as const;

/**
 * One team from a CSV row. Player names stay raw here and resolve to
 * `people/{id}` paths at save time. Teams are unnamed — `position` is the
 * 1-based column index (`team_1` → 1).
 */
export interface PictionaryTeamCsv {
  position: number;
  playerNames: string[];
  won: boolean;
}

export interface PictionaryGameCsvData {
  played_at: string;
  location?: string;
  winning_word?: string;
  notes?: string;
  teams: PictionaryTeamCsv[];
}

type PeopleByName = Map<string, string>;

const validatePlayedAt: FieldValidator<string> = (value) => {
  const raw = value.trim();
  if (!raw) return { value: '', error: 'played_at is required' };

  // Anchor a bare date to UTC midnight so the stored string round-trips.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const date = new Date(isDateOnly ? `${raw}T00:00:00Z` : raw);
  if (Number.isNaN(date.getTime())) {
    return { value: raw, error: 'must be a date (YYYY-MM-DD or ISO 8601)' };
  }
  return { value: date.toISOString() };
};

interface TeamCell {
  playerNames: string[];
}

/**
 * Validator for one `team_N` column. Unknown player names are reported here so
 * they surface in the preview rather than failing midway through the import.
 */
function makeTeamValidator(
  columnName: string,
  required: boolean,
  peopleByName: PeopleByName,
): FieldValidator<TeamCell | null> {
  return (value) => {
    const cell = value.trim();
    if (!cell) {
      return required ? { value: null, error: `${columnName} is required` } : { value: null };
    }

    const playerNames = cell
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (playerNames.length === 0) {
      return { value: null, error: `${columnName}: team has no players` };
    }

    const missing = playerNames.filter((n) => !peopleByName.has(n.toLowerCase()));
    if (missing.length > 0) {
      return {
        value: { playerNames },
        error: `${columnName}: unknown player(s): ${missing.join(', ')}`,
      };
    }
    return { value: { playerNames } };
  };
}

/** `winner` names a team by position; check it's in range and has players. */
const validateWinner: FieldValidator<number | undefined> = (value, row) => {
  const raw = value.trim();
  if (!raw) return { value: undefined };

  const position = Number(raw);
  if (!Number.isInteger(position) || position < 1 || position > TEAM_COLUMNS.length) {
    return {
      value: undefined,
      error: `must be a team position between 1 and ${TEAM_COLUMNS.length}`,
    };
  }
  if (!row[TEAM_COLUMNS[position - 1]]?.trim()) {
    return { value: undefined, error: `position ${position} has no team in this row` };
  }
  return { value: position };
};

function teamFields(peopleByName: PeopleByName): CsvFieldConfig[] {
  return TEAM_COLUMNS.map((col, i) => ({
    name: col,
    required: i < 2,
    validator: makeTeamValidator(col, i < 2, peopleByName),
    description: `Team ${i + 1} as comma-separated player names${i < 2 ? ' (required)' : ''}`,
  }));
}

export function makePictionaryCsvSchema(
  peopleByName: PeopleByName,
): CsvSchema<PictionaryGameCsvData> {
  const teams = teamFields(peopleByName);
  return {
    requiredFields: [
      {
        name: 'played_at',
        required: true,
        validator: validatePlayedAt,
        description: 'Date the game was played (YYYY-MM-DD or ISO 8601)',
      },
      teams[0],
      teams[1],
    ],
    optionalFields: [
      {
        name: 'location',
        required: false,
        validator: validateOptionalString(200),
        description: 'Where the game was played (max 200 characters)',
      },
      {
        name: 'winning_word',
        required: false,
        validator: validateOptionalString(200),
        description: 'The winning word/prompt (max 200 characters)',
      },
      {
        name: 'notes',
        required: false,
        validator: validateOptionalString(2000),
        description: 'Free-text notes (max 2000 characters)',
      },
      ...teams.slice(2),
      {
        name: 'winner',
        required: false,
        validator: validateWinner,
        description: '1-based position of the winning team (e.g. 1 for team_1)',
      },
    ],
    // Collapse the six team columns into one list.
    transformParsed: (raw) => {
      const winner = raw.winner as number | undefined;
      const teams: PictionaryTeamCsv[] = [];
      TEAM_COLUMNS.forEach((col, i) => {
        const cell = raw[col] as TeamCell | null | undefined;
        if (!cell) return;
        teams.push({
          position: i + 1,
          playerNames: cell.playerNames,
          won: winner === i + 1,
        });
      });
      return {
        played_at: raw.played_at as string,
        location: raw.location as string | undefined,
        winning_word: raw.winning_word as string | undefined,
        notes: raw.notes as string | undefined,
        teams,
      };
    },
    labelFor: (raw) =>
      raw.played_at ? `Game on ${String(raw.played_at).slice(0, 10)}` : undefined,
  };
}

export const template = () =>
  [
    ['played_at', 'location', 'winning_word', 'notes', ...TEAM_COLUMNS, 'winner'].join(','),
    '2026-04-25,Living Room,banana,Fun night,"Alice,Bob","Charlie,Dave",,,,,1',
    '2026-04-26,Kitchen,eiffel tower,,"Eve","Frank,Grace","Heidi,Ivan",,,,2',
    '',
  ].join('\n');

interface PersonRecord {
  id: string;
  name: string;
}

async function loadPeopleMap(ctx: BulkImportContext): Promise<PeopleByName> {
  const people = await serverClient(ctx.auth.token).collection<PersonRecord>(PEOPLE).listAll();
  return new Map(people.map((p) => [p.name.toLowerCase(), p.id]));
}

/**
 * Loads the people map, then parses against it. A custom parser rather than a
 * bare `createCsvParser` because the column validators need data only the
 * server can fetch.
 */
const parser: BulkImportParser<PictionaryGameCsvData> = {
  async parse(input, ctx) {
    const peopleByName = await loadPeopleMap(ctx);
    return createCsvParser(makePictionaryCsvSchema(peopleByName)).parse(input, ctx);
  },
};

/** One row → one game record plus a team child per populated team column. */
export const save: BulkImportSaver<PictionaryGameCsvData> = async ({ items, ctx }) => {
  const peopleByName = await loadPeopleMap(ctx);
  const hs = serverClient(ctx.auth.token);
  const games = hs.collection<{ id: string }>(PICTIONARY_GAMES);
  const createdBy = ctx.auth.user.path;
  let created = 0;
  const failed: BulkImportSaveResult['failed'] = [];

  for (const item of items) {
    const data = item.data;
    try {
      // Resolve every player first: a half-created game with missing teams is
      // worse than a row that didn't import. The parser already checked these,
      // but someone could have been deleted between preview and import.
      const teams = data.teams.map((team) => ({
        ...team,
        playerPaths: resolvePlayers(team, peopleByName),
      }));

      const game = await games.create({
        played_at: data.played_at,
        location: data.location,
        winning_word: data.winning_word,
        notes: data.notes,
        created_by: createdBy,
      });

      const teamsCollection = games.record(game.id).collection(PICTIONARY_TEAMS);
      await Promise.all(
        teams.map((team) =>
          teamsCollection.create({
            players: team.playerPaths,
            won: team.won,
            rank: team.position,
            created_by: createdBy,
          }),
        ),
      );
      created++;
    } catch (error) {
      failed.push({
        index: item.index,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { created, failed };
};

function resolvePlayers(team: PictionaryTeamCsv, peopleByName: PeopleByName): string[] {
  const missing: string[] = [];
  const resolved: string[] = [];
  for (const name of team.playerNames) {
    const id = peopleByName.get(name.toLowerCase());
    if (id) resolved.push(`people/${id}`);
    else missing.push(name);
  }
  if (missing.length > 0) {
    throw new Error(`Team ${team.position} has unknown player(s): ${missing.join(', ')}`);
  }
  return resolved;
}

export default parser;
