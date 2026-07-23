import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const GAMES = 'games' as const;
export const GAME_HOLES = 'holes' as const;

export const minigolfResources: ResourceDefinition[] = [
  {
    singular: 'game',
    plural: GAMES,
    description: 'A mini golf game session.',
    user_settable_create: true,
    fields: {
      location: { type: 'string' },
      played_at: { type: 'string', description: 'RFC3339 timestamp' },
      players: {
        type: 'array',
        items: { type: 'string', reference: { resource: 'person' } },
        required: true,
      },
      hole_count: { type: 'number', required: true },
      completed: { type: 'boolean' },
      notes: { type: 'string' },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
  {
    singular: 'hole',
    plural: GAME_HOLES,
    description: 'A single hole within a mini golf game.',
    user_settable_create: true,
    parents: ['game'],
    fields: {
      hole_number: { type: 'number', required: true },
      par: { type: 'number', required: true },
      scores: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            player: {
              type: 'string',
              reference: { resource: 'person' },
            },
            strokes: { type: 'number' },
          },
        },
        required: true,
      },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
];
