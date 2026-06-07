/**
 * Build the static module-access map the launcher injects into the aepbase
 * child (as the `AEPBASE_MODULE_ACCESS` env var) so aepbase can enforce
 * module visibility server-side.
 *
 * The map answers the two questions the Go middleware can't derive on its own
 * (module ownership is a TypeScript-only concept): which module owns a given
 * collection, and what each module's default visibility is. The *dynamic*
 * half of the decision — current flag values and the user's tags — is read
 * live from aepbase's own SQLite by the middleware.
 *
 * Reads the already-initialized registry singleton, so the caller must boot
 * the registry first (see `initializeModuleRegistry`).
 */

import { getAllResourceDefsWithModule } from './registry';
import {
  DEFAULT_MODULE_VISIBILITY,
  type ModuleVisibility,
} from '../settings/visibility';

export interface ModuleAccessMap {
  /** Collection plural → owning module id (gated feature collections only). */
  collectionToModule: Record<string, string>;
  /** Module id → default visibility, used when no flag value is stored yet. */
  moduleDefaults: Record<string, ModuleVisibility>;
}

/**
 * Derive the access map from the registry. Collections owned by a module in
 * `excludeModuleIds` (the always-installed core modules) are left out so they
 * are never gated.
 */
export function buildModuleAccessMap(
  excludeModuleIds: readonly string[] = [],
): ModuleAccessMap {
  const exclude = new Set(excludeModuleIds);
  const collectionToModule: Record<string, string> = {};
  const moduleDefaults: Record<string, ModuleVisibility> = {};
  for (const { module, def } of getAllResourceDefsWithModule()) {
    if (exclude.has(module.id)) continue;
    collectionToModule[def.plural] = module.id;
    moduleDefaults[module.id] = module.defaultEnabled ?? DEFAULT_MODULE_VISIBILITY;
  }
  return { collectionToModule, moduleDefaults };
}
