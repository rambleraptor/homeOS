// App registry + operator config access for the server.
//
// Implemented in JS (with a hand-written app-registry.d.ts) so this package's
// `tsc` doesn't follow the imports into the app graph — AppConfig types
// reference React component types, which are type-checked by the frontend
// project under its DOM + JSX config, not ours. The server runs from source
// (bun, or node + tsx) — nothing here is bundled into the launcher binary.
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
  getAllCronHooks,
} from '@rambleraptor/homestead-core/apps/registry';
import {
  ALWAYS_INSTALLED_APP_IDS,
  withAlwaysInstalled,
} from '@rambleraptor/homestead-core/apps/core-apps';
import { buildAppAccessMap } from '@rambleraptor/homestead-core/apps/access-map';
import { mergeDiscoveredApps } from '@rambleraptor/homestead-core/apps/discovery';
import {
  defaultAppsDir,
  discoverApps,
} from '@rambleraptor/homestead-core/server/app-discovery';
import { handleChat } from '@rambleraptor/homestead-core/server/chat/handler';
import { pathToFileURL } from 'node:url';

// Resolve the operator's config the same way the SPA does (vite.config.ts):
// the launcher points HOMESTEAD_CONFIG at <project>/homestead.config.ts. A
// hardcoded relative import only works in the source monorepo — once this
// package is installed under node_modules/@rambleraptor/homestead-server, the
// scope adds a path segment so `../../../` lands in node_modules/. The
// relative fallback keeps the workspace/dev layout (and direct
// `bun src/index.ts` invocations) working. Dynamic import is fine: this module
// already uses top-level await and server.ts loads it via dynamic import.
const config = (
  await import(
    process.env.HOMESTEAD_CONFIG
      ? pathToFileURL(process.env.HOMESTEAD_CONFIG).href
      : '../../../homestead.config.ts'
  )
).default;

// Apps dropped under the project's apps/ dir (apps/*/app.homestead.ts)
// are picked up on top of the config's explicit list.
initializeAppRegistry(
  withAlwaysInstalled(
    mergeDiscoveredApps(config.apps ?? [], await discoverApps(defaultAppsDir())),
  ),
);

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

/** The `ai` block of homestead.config.ts, or null when AI is unconfigured. */
export function aiConfig() {
  return config.ai ?? null;
}

/** The `embedding` block of homestead.config.ts, or null when unconfigured. */
export function embeddingConfig() {
  return config.embedding ?? null;
}

export {
  getResourceCustomMethod,
  getAllResourceCustomMethods,
  getAllResourceDefs,
  getAllAppFlagDefs,
  getAllUserSettingDefs,
  getAllCronHooks,
  handleChat,
};
