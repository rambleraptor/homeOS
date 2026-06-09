/**
 * Build the static app-access map the launcher injects into the aepbase
 * child (as the `AEPBASE_APP_ACCESS` env var) so aepbase can enforce
 * app visibility server-side.
 *
 * The map answers the two questions the Go middleware can't derive on its own
 * (app ownership is a TypeScript-only concept): which app owns a given
 * collection, and what each app's default visibility is. The *dynamic*
 * half of the decision — current flag values and the user's tags — is read
 * live from aepbase's own SQLite by the middleware.
 *
 * Reads the already-initialized registry singleton, so the caller must boot
 * the registry first (see `initializeAppRegistry`).
 */

import { getAllResourceDefsWithApp } from './registry';
import {
  DEFAULT_APP_VISIBILITY,
  type AppVisibility,
} from '../settings/visibility';

export interface AppAccessMap {
  /** Collection plural → owning app id (gated feature collections only). */
  collectionToApp: Record<string, string>;
  /** App id → default visibility, used when no flag value is stored yet. */
  appDefaults: Record<string, AppVisibility>;
}

/**
 * Derive the access map from the registry. Collections owned by an app in
 * `excludeAppIds` (the always-installed core apps) are left out so they
 * are never gated.
 */
export function buildAppAccessMap(
  excludeAppIds: readonly string[] = [],
): AppAccessMap {
  const exclude = new Set(excludeAppIds);
  const collectionToApp: Record<string, string> = {};
  const appDefaults: Record<string, AppVisibility> = {};
  for (const { app, def } of getAllResourceDefsWithApp()) {
    if (exclude.has(app.id)) continue;
    collectionToApp[def.plural] = app.id;
    appDefaults[app.id] = app.defaultEnabled ?? DEFAULT_APP_VISIBILITY;
  }
  return { collectionToApp, appDefaults };
}
