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
import { withAlwaysInstalled } from '@rambleraptor/homestead-core/modules/core-modules';
import config from '../../../homestead.config';

initializeModuleRegistry(withAlwaysInstalled(config.modules));

export { getModuleWorker };
