/**
 * Resource definitions that aren't owned by a feature app.
 *
 * These cover platform-level concerns: the generic action/run pair
 * used by the actions runtime. Kept in core so the runner has a
 * single, deterministic list to apply alongside the per-app
 * definitions.
 *
 * Two resources are *not* listed here because their schemas are
 * generated from declarations and applied by dedicated syncers:
 *   - `app-flag`     ← built from `getAllAppFlagDefs()`
 *   - `user-preference` ← built from `getAllUserSettingDefs()`
 *
 * Both syncers run from `frontend/src/instrumentation.ts` on Next.js
 * boot, after this list is applied.
 */

import type { ResourceDefinition } from './types';

/**
 * The `user` collection itself isn't declared here — aepbase manages it
 * internally — but hooks need its plural to build parent paths for
 * user-scoped children (preferences, notifications, etc.).
 */
export const USERS = 'users' as const;
export const USER_PREFERENCES = 'preferences' as const;
export const ACTIONS = 'actions' as const;
export const RUNS = 'runs' as const;
export const PERSONAL_ACCESS_TOKENS = 'personal-access-tokens' as const;
export const FAVORITES = 'favorites' as const;

export const BUILTIN_RESOURCE_DEFS: ResourceDefinition[] = [
  {
    singular: 'action',
    plural: ACTIONS,
    description:
      'A user-defined automation backed by a server-side script.',
    user_settable_create: true,
    fields: {
      name: { type: 'string', required: true },
      description: { type: 'string' },
      script_id: { type: 'string', required: true },
      parameters: { type: 'object' },
      last_run_at: { type: 'string', format: 'date-time' },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
  {
    singular: 'run',
    plural: RUNS,
    description: 'A single execution of an action.',
    user_settable_create: true,
    parents: ['action'],
    fields: {
      status: { type: 'string', required: true },
      started_at: { type: 'string', format: 'date-time' },
      completed_at: { type: 'string', format: 'date-time' },
      duration_ms: { type: 'number' },
      error: { type: 'string' },
      result: { type: 'object' },
      input_request: { type: 'object' },
      input_response: { type: 'object' },
    },
  },
  {
    // A personal access token a user issues for themselves. This record holds
    // only *non-secret* metadata: the bearer secret is stored hashed in the
    // engine's `_tokens` table (never here), and a token's authority lives in
    // `access-grant` records addressed to it (subject_type = 'token'). Both are
    // created/torn down by the `/api/tokens` mint + revoke route. `owner` access
    // keeps each user's tokens private to them.
    singular: 'personal-access-token',
    plural: PERSONAL_ACCESS_TOKENS,
    description: 'A personal access token the owner can use for API calls.',
    user_settable_create: true,
    parents: ['user'],
    fields: {
      name: { type: 'string', required: true },
      // First few characters of the secret (e.g. `hsd_pat_ab12cd`), so the UI
      // can identify a token in the list without ever holding the full value.
      token_prefix: { type: 'string' },
      // Optional: absent means the token never expires.
      expires_at: { type: 'string', format: 'date-time' },
      last_used_at: { type: 'string', format: 'date-time' },
      // Display copy of the grants assigned to this token, so the settings UI
      // can render a token's scopes without a second query. Authoritative
      // enforcement always uses the `access-grant` records, not this field.
      scopes: {
        type: 'array',
        description: 'Grants assigned to this token (display copy).',
        items: {
          type: 'object',
          properties: {
            capability: { type: 'string', enum: ['read', 'write', 'manage'] },
            target_scope: { type: 'string', enum: ['all', 'app', 'collection'] },
            target_app: { type: 'string' },
            resource_type: { type: 'string' },
            filter: { type: 'string' },
            effect: { type: 'string', enum: ['allow', 'deny'] },
          },
        },
      },
    },
  },
  {
    // A record the owner has starred so pickers can surface it first. The link
    // is polymorphic — `target_resource` names the kind (e.g. `person`) and
    // `target_id` the record — so one collection serves stars for any resource
    // without a per-resource favorites table. Parented under `user` + `owner`
    // access keeps each household member's stars private to them. A stale
    // favorite (its target deleted) is inert: pickers simply don't resolve it.
    singular: 'favorite',
    plural: FAVORITES,
    description:
      "A record the owner has starred, to surface it first in pickers. Polymorphic: target_resource names the kind, target_id the record.",
    user_settable_create: true,
    parents: ['user'],
    fields: {
      target_resource: {
        type: 'string',
        required: true,
        description: 'singular name of the starred resource, e.g. person',
      },
      target_id: {
        type: 'string',
        required: true,
        description: 'id of the starred record (bare, no collection prefix)',
      },
    },
  },
];
