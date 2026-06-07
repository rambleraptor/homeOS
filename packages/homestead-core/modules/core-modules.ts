/**
 * The always-installed core modules and the helper that merges them into
 * an operator's module list.
 *
 * Kept out of `registry.ts` on purpose: that file imports zero `HomeModule`
 * instances so a bare `import` stays type-only (see the note at the top of
 * registry.ts). This module is the one place that names the core modules, so
 * every consumer that boots the registry from a config (the SPA shim, the
 * sidecar, and the launcher's module-access serializer) shares one list and
 * can't drift.
 */

import { settingsModule } from '../settings/module.config';
import { superuserModule } from '../superuser/module.config';
import { usersModule } from '../users/module.config';
import type { HomeModule } from './types';

/**
 * Modules every instance ships regardless of the operator's config. Their
 * collections are part of the core experience and are never gated by the
 * backend module-access middleware (aepbase's own user-parenting protects
 * the user-scoped ones).
 */
export const ALWAYS_INSTALLED_MODULES: HomeModule[] = [
  superuserModule,
  usersModule,
  settingsModule,
];

/** Ids of the always-installed core modules. */
export const ALWAYS_INSTALLED_MODULE_IDS: string[] = ALWAYS_INSTALLED_MODULES.map(
  (m) => m.id,
);

/**
 * Append the always-installed core modules to an operator's module list,
 * skipping any the operator already declared (matched by id).
 */
export function withAlwaysInstalled(operatorModules: HomeModule[]): HomeModule[] {
  const seen = new Set(operatorModules.map((m) => m.id));
  const merged = [...operatorModules];
  for (const core of ALWAYS_INSTALLED_MODULES) {
    if (!seen.has(core.id)) merged.push(core);
  }
  return merged;
}
