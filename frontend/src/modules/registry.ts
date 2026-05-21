/**
 * Module registry boot shim.
 *
 * The contract types, registry implementation, and helpers all live in
 * `@rambleraptor/homestead-core/modules/registry`. This file's only job
 * is to install the singleton with the full module list — the operator's
 * modules from `homestead.config.ts` plus the always-installed core
 * modules (settings, users, superuser) that the rest of the app depends
 * on. Importing this module triggers the side effect, and the re-export
 * keeps existing `@/modules/registry` call sites working.
 */

import { initializeModuleRegistry } from '@rambleraptor/homestead-core/modules/registry';
import { settingsModule } from '@rambleraptor/homestead-core/settings/module.config';
import { superuserModule } from '@rambleraptor/homestead-core/superuser/module.config';
import { usersModule } from '@rambleraptor/homestead-core/users/module.config';
import config from '../../homestead.config';
import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';

const ALWAYS_INSTALLED: HomeModule[] = [
  superuserModule,
  usersModule,
  settingsModule,
];

function withAlwaysInstalled(operatorModules: HomeModule[]): HomeModule[] {
  const seen = new Set(operatorModules.map((m) => m.id));
  const merged = [...operatorModules];
  for (const core of ALWAYS_INSTALLED) {
    if (!seen.has(core.id)) merged.push(core);
  }
  return merged;
}

initializeModuleRegistry(withAlwaysInstalled(config.modules));

export * from '@rambleraptor/homestead-core/modules/registry';
