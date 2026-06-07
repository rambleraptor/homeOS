// Serialize the module-access map for the aepbase child's AEPBASE_MODULE_ACCESS
// env var. aepbase enforces module visibility server-side but can't derive
// module ownership (a TypeScript-only concept), so the launcher hands it a
// collection→module map + per-module default visibility, built from the same
// registry the SPA and sidecar use.
//
// Implemented in JS (with a hand-written module-access.d.ts) so the CLI's `tsc`
// doesn't follow these imports into the app/module graph (DOM/JSX) — same trick
// as load-config.js and sidecar-inproc.js. `bun build --compile` still bundles
// the real registry into the binary.
import { initializeModuleRegistry } from '@rambleraptor/homestead-core/modules/registry';
import {
  ALWAYS_INSTALLED_MODULE_IDS,
  withAlwaysInstalled,
} from '@rambleraptor/homestead-core/modules/core-modules';
import { buildModuleAccessMap } from '@rambleraptor/homestead-core/modules/access-map';
import config from '../../../homestead.config.ts';

/**
 * AEPBASE_MODULE_ACCESS value for the loaded config. Returns undefined when no
 * feature-module collections are gated, leaving aepbase enforcement off.
 */
export function moduleAccessEnv() {
  initializeModuleRegistry(withAlwaysInstalled(config.modules));
  const map = buildModuleAccessMap(ALWAYS_INSTALLED_MODULE_IDS);
  if (Object.keys(map.collectionToModule).length === 0) return undefined;
  return JSON.stringify(map);
}
