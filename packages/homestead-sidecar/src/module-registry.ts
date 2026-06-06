/**
 * Initialize the module registry inside the sidecar.
 *
 * Mirrors the app boot shim (`packages/homestead-app/src/modules/registry.ts`):
 * the operator's modules from the repo-root `homestead.config.ts` plus
 * the always-installed core modules (settings, users, superuser). Other
 * sidecar modules import this for its side effect (and `getModuleWorker`).
 */

import {
  initializeModuleRegistry,
  getModuleWorker,
} from '@rambleraptor/homestead-core/modules/registry';
import { settingsModule } from '@rambleraptor/homestead-core/settings/module.config';
import { superuserModule } from '@rambleraptor/homestead-core/superuser/module.config';
import { usersModule } from '@rambleraptor/homestead-core/users/module.config';
import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import config from '../../../homestead.config';

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

export { getModuleWorker };
