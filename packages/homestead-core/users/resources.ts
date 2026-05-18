import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

/**
 * The aepbase user resource has a fixed schema — custom fields can't
 * be added to it — so account tags are modeled as a child collection:
 * one record per (user, tag) pair, parented under the user.
 *
 * Access is admin/superuser-only by convention (the only UI that
 * writes here lives in the superuser-gated Users module). User-parent
 * scoping means a regular user can still list their own tags, which
 * is needed for the client-side module-visibility gate.
 */
export const ACCOUNT_TAGS = 'account-tags' as const;

export const usersResources: ResourceDefinition[] = [
  {
    singular: 'account-tag',
    plural: ACCOUNT_TAGS,
    description:
      'A tag assigned to a user account by a superuser. Pair with a module\'s `enabled_tags` flag to gate access by tag.',
    user_settable_create: true,
    parents: ['user'],
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The tag name. Trimmed, case-preserved.',
        },
      },
      required: ['name'],
    },
  },
];
