/**
 * Build the collection→app map the server hands to the permission engine
 * (`setPermissionAppMap`) so app-scope access-grants can match a request to its
 * owning app.
 *
 * (This used to also carry each app's default `enabled` visibility for the old
 * app-access gate; that gate was retired — app-level audience is governed by
 * the permission system now — so only the ownership map remains.)
 *
 * Reads the already-initialized registry singleton, so the caller must boot
 * the registry first (see `initializeAppRegistry`).
 */

import { getAllResourceDefsWithApp } from './registry';

export interface AppAccessMap {
  /** Collection plural → owning app id. */
  collectionToApp: Record<string, string>;
}

/**
 * Derive the map from the registry. Collections owned by an app in
 * `excludeAppIds` (the always-installed core apps) are left out.
 */
export function buildAppAccessMap(
  excludeAppIds: readonly string[] = [],
): AppAccessMap {
  const exclude = new Set(excludeAppIds);
  const collectionToApp: Record<string, string> = {};
  for (const { app, def } of getAllResourceDefsWithApp()) {
    if (exclude.has(app.id)) continue;
    collectionToApp[def.plural] = app.id;
  }
  return { collectionToApp };
}
