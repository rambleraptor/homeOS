// App registry + operator config access for the server.
//
// Implemented in JS (with a hand-written app-registry.d.ts) so this package's
// `tsc` doesn't follow the imports into the app graph — AppConfig types
// reference React component types, which are type-checked by the frontend
// project under its DOM + JSX config, not ours. `bun build --compile` still
// follows these imports and bundles the real registry + config.
//
// Importing this module initializes the registry exactly once (same shim as
// the SPA's src/apps/registry.ts and the old sidecar's app-registry.ts).

import {
  initializeAppRegistry,
  getResourceCustomMethod,
  getAllResourceCustomMethods,
  getAllResourceDefs,
  getAllAppFlagDefs,
  getAllUserSettingDefs,
} from '@rambleraptor/homestead-core/apps/registry';
import {
  ALWAYS_INSTALLED_APP_IDS,
  withAlwaysInstalled,
} from '@rambleraptor/homestead-core/apps/core-apps';
import { buildAppAccessMap } from '@rambleraptor/homestead-core/apps/access-map';
import { handleChat } from '@rambleraptor/homestead-core/server/chat/handler';
import config from '../../../homestead.config.ts';

initializeAppRegistry(withAlwaysInstalled(config.apps));

/**
 * The collection→app gating map derived from the registry, or null when no
 * feature-app collections are gated (enforcement off).
 */
export function appAccessMap() {
  const map = buildAppAccessMap(ALWAYS_INSTALLED_APP_IDS);
  if (Object.keys(map.collectionToApp).length === 0) return null;
  return map;
}

/** The `auth.oauth` block of homestead.config.ts, or null when absent. */
export function oauthConfig() {
  return config.auth?.oauth ?? null;
}

export {
  getResourceCustomMethod,
  getAllResourceCustomMethods,
  getAllResourceDefs,
  getAllAppFlagDefs,
  getAllUserSettingDefs,
  handleChat,
};
