/**
 * Read a household app flag server-side.
 *
 * App flags are declared on an app config (`flags: { ... }`), flattened by the
 * schema sync into one `${app_id}__${key}` column on the `app-flags`
 * singleton, and edited from the superuser Flag Management page. The SPA reads
 * them through `useAppFlag`; server code that has to branch on one (the MCP
 * route's tool surface) reads the column straight off the engine's own db, so
 * it costs one indexed row read and no HTTP hop, and picks up an edit on the
 * very next request without a restart.
 *
 * The engine does the same thing for `defaultFromFlag` fields
 * (`./engine/defaults.ts`) — this is the same read, addressed by (app, key)
 * instead of by wire marker.
 */

import { fieldName } from '@rambleraptor/homestead-core/settings/flags';
import { APP_FLAGS } from '@rambleraptor/homestead-core/app-flags/sync';
import type { AppFlagValue } from '@rambleraptor/homestead-core/apps/types';
import { listResources } from './engine/store';
import type { Engine } from './engine/engine';

/**
 * The value of `appId`'s `key` flag, or undefined when the flag has never been
 * set (no `app-flags` row yet, the column is absent because the schema sync
 * hasn't run, or the value is blank). Callers supply their own default.
 *
 * Never throws: a flag read must not be able to take down the route branching
 * on it, so a missing collection or a malformed row reads as "unset".
 */
export function readAppFlag(
  engine: Engine,
  appId: string,
  key: string,
): AppFlagValue | undefined {
  try {
    const def = engine.registry.all().find((r) => r.plural === APP_FLAGS);
    if (!def) return undefined;
    const { results } = listResources(engine.db, APP_FLAGS, {}, def.schema, 1, '', 0, '');
    const value = results[0]?.fields[fieldName(appId, key)];
    if (value === undefined || value === null || value === '') return undefined;
    return value as AppFlagValue;
  } catch {
    return undefined;
  }
}
