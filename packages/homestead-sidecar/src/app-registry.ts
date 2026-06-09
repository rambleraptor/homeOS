/**
 * Initialize the app registry inside the sidecar.
 *
 * Mirrors the app boot shim (`packages/homestead-app/src/apps/registry.ts`):
 * the operator's apps from the repo-root `homestead.config.ts` plus
 * the always-installed core apps (settings, users, superuser). Other
 * sidecar apps import this for its side effect (and
 * `getResourceCustomMethod`).
 */

import {
  initializeAppRegistry,
  getResourceCustomMethod,
} from '@rambleraptor/homestead-core/apps/registry';
import { withAlwaysInstalled } from '@rambleraptor/homestead-core/apps/core-apps';
import config from '../../../homestead.config';

initializeAppRegistry(withAlwaysInstalled(config.apps));

export { getResourceCustomMethod };
