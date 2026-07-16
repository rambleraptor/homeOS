import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const PICTIONARY_GAMES = 'pictionary-games' as const;
export const PICTIONARY_TEAMS = 'pictionary-teams' as const;

export const pictionaryResources: ResourceDefinition[] = [
  {
    singular: 'pictionary-game',
    plural: PICTIONARY_GAMES,
    description: 'A single Pictionary game session.',
    user_settable_create: true,
    fields: {
      played_at: {
        type: 'string',
        description: 'RFC3339 timestamp of the game',
        required: true,
      },
      location: { type: 'string' },
      winning_word: {
        type: 'string',
        description: 'The clue/word the winning team guessed',
      },
      winning_word_image: {
        type: 'file',
        description:
          'Picture of the winning word/drawing (jpeg/png/webp/gif, <=5MB)',
      },
      notes: { type: 'string' },
      created_by: { type: 'string', description: 'users/{user_id}' },
    },
    bulkImport: {
      formats: [
        {
          id: 'csv',
          label: 'CSV',
          inputType: 'file',
          accept: '.csv',
          hasTemplate: true,
          load: () => import('./methods/bulk-import-csv'),
        },
      ],
      // One row becomes a game plus a team child per populated team column.
      save: () => import('./methods/bulk-import-csv'),
    },
  },
  {
    singular: 'pictionary-team',
    plural: PICTIONARY_TEAMS,
    description: 'A team within a Pictionary game.',
    user_settable_create: true,
    parents: ['pictionary-game'],
    fields: {
      players: {
        type: 'array',
        items: { type: 'string' },
        description: 'Player resource paths (people/{id})',
        required: true,
      },
      won: { type: 'boolean' },
      rank: {
        type: 'number',
        description:
          '1-based position within the game; teams have no name',
      },
      created_by: { type: 'string' },
    },
  },
];
