// Serialize the app-access map for the aepbase child's AEPBASE_APP_ACCESS
// env var. aepbase enforces app visibility server-side but can't derive
// app ownership (a TypeScript-only concept), so the launcher hands it a
// collection→app map + per-app default visibility, built from the same
// registry the SPA and sidecar use.
//
// Implemented in JS (with a hand-written app-access.d.ts) so the CLI's `tsc`
// doesn't follow these imports into the app/app graph (DOM/JSX) — same trick
// as load-config.js and sidecar-inproc.js. `bun build --compile` still bundles
// the real registry into the binary.
import { initializeAppRegistry } from '@rambleraptor/homestead-core/apps/registry';
import {
  ALWAYS_INSTALLED_APP_IDS,
  withAlwaysInstalled,
} from '@rambleraptor/homestead-core/apps/core-apps';
import { buildAppAccessMap } from '@rambleraptor/homestead-core/apps/access-map';
import config from '../../../homestead.config.ts';

/**
 * AEPBASE_APP_ACCESS value for the loaded config. Returns undefined when no
 * feature-app collections are gated, leaving aepbase enforcement off.
 */
export function appAccessEnv() {
  initializeAppRegistry(withAlwaysInstalled(config.apps));
  const map = buildAppAccessMap(ALWAYS_INSTALLED_APP_IDS);
  if (Object.keys(map.collectionToApp).length === 0) return undefined;
  return JSON.stringify(map);
}
