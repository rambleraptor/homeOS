import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

/**
 * The aepbase user resource has a fixed schema — custom fields can't
 * be added to it — so account tags are modeled as a child collection:
 * one record per (user, tag) pair, parented under the user.
 *
 * Writes are superuser-only, enforced by the engine (`superuser_write`):
 * because account tags gate app access, a regular user must not be able
 * to grant themselves a tag. User-parent scoping still lets a regular
 * user *read* their own tags, which the client-side app-visibility gate
 * needs.
 */
export const ACCOUNT_TAGS = 'account-tags' as const;

export const usersResources: ResourceDefinition[] = [
  {
    singular: 'account-tag',
    plural: ACCOUNT_TAGS,
    description:
      'A tag assigned to a user account by a superuser. Pair with an app\'s `enabled_tags` flag to gate access by tag.',
    user_settable_create: true,
    // Superuser-only writes: tags gate app access, so a user must not be
    // able to change their own. Reads stay owner-scoped via user parenting.
    superuser_write: true,
    parents: ['user'],
    fields: {
      name: {
        type: 'string',
        description: 'The tag name. Trimmed, case-preserved.',
        required: true,
      },
    },
  },
];
