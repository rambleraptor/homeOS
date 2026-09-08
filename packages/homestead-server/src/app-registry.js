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
  getAllApps,
  getResourceCustomMethod,
  getAllResourceCustomMethods,
  getAllResourceDefs,
  getAllAppFlagDefs,
  getAllUserSettingDefs,
  getAllCronHooks,
  getAllMigrations,
  getAllResourceSyncs as getAppResourceSyncs,
} from '@rambleraptor/homestead-core/apps/registry';
import {
  ALWAYS_INSTALLED_APP_IDS,
  withAlwaysInstalled,
} from '@rambleraptor/homestead-core/apps/core-apps';
import { buildAppAccessMap } from '@rambleraptor/homestead-core/apps/access-map';
import { mergeDiscoveredApps } from '@rambleraptor/homestead-core/apps/discovery';
import {
  appsDirs,
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

// Apps dropped under the project's app directories (*/app.homestead.ts) are
// picked up on top of the config's explicit list. That's <project>/apps by
// default, or every directory named by HOMESTEAD_APPS_DIRS when it is set.
initializeAppRegistry(
  withAlwaysInstalled(
    mergeDiscoveredApps(config.apps ?? [], await discoverApps(appsDirs())),
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

/** The `auth.authServer` block of homestead.config.ts, or null when absent. */
export function authServerConfig() {
  return config.auth?.authServer ?? null;
}

/** The `ai` block of homestead.config.ts, or null when AI is unconfigured. */
export function aiConfig() {
  return config.ai ?? null;
}

/** The `embedding` block of homestead.config.ts, or null when unconfigured. */
export function embeddingConfig() {
  return config.embedding ?? null;
}

/** The `email` block of homestead.config.ts, or null when email is unconfigured. */
export function emailConfig() {
  return config.email ?? null;
}

/**
 * Every resource sync the instance runs: the app-declared ones (from
 * `AppConfig.syncs`, aggregated by the core registry) plus the config-level
 * ones an operator declares directly in `homestead.config.ts` (`config.syncs`).
 * Config-level syncs carry `appId: 'config'` and are the way to attach a sync
 * to a resource no app owns — notably the built-in `user`. Ids must be unique
 * across both sources; a config sync whose id collides with an app sync (or
 * that is missing an `id`/`resource`) is dropped with a warning.
 */
export function getAllResourceSyncs() {
  const appSyncs = getAppResourceSyncs();
  const seen = new Set(appSyncs.map((s) => s.id));
  const configSyncs = [];
  for (const sync of config.syncs ?? []) {
    if (!sync || !sync.id || !sync.resource) {
      console.warn(
        '[app-registry] config sync missing id or resource; ignored',
        sync && sync.id,
      );
      continue;
    }
    if (seen.has(sync.id)) {
      console.warn(
        `[app-registry] duplicate resource sync id "${sync.id}" from config; ignored`,
      );
      continue;
    }
    seen.add(sync.id);
    configSyncs.push({ ...sync, appId: 'config' });
  }
  return [...appSyncs, ...configSyncs];
}

export {
  getAllApps,
  getResourceCustomMethod,
  getAllResourceCustomMethods,
  getAllResourceDefs,
  getAllAppFlagDefs,
  getAllUserSettingDefs,
  getAllCronHooks,
  getAllMigrations,
  handleChat,
};
