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
];
