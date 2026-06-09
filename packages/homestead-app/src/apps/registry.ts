/**
 * App registry boot shim.
 *
 * The contract types, registry implementation, and helpers all live in
 * `@rambleraptor/homestead-core/apps/registry`. This file's only job
 * is to install the singleton with the full app list — the operator's
 * apps from `homestead.config.ts` plus the always-installed core
 * apps (settings, users, superuser) that the rest of the app depends
 * on. Importing this app triggers the side effect, and the re-export
 * keeps existing `@/apps/registry` call sites working.
 */

import { initializeAppRegistry } from '@rambleraptor/homestead-core/apps/registry';
import { settingsApp } from '@rambleraptor/homestead-core/settings/app.config';
import { superuserApp } from '@rambleraptor/homestead-core/superuser/app.config';
import { usersApp } from '@rambleraptor/homestead-core/users/app.config';
import config from '@homestead/config';
import type { HomeApp } from '@rambleraptor/homestead-core/apps/types';

const ALWAYS_INSTALLED: HomeApp[] = [
  superuserApp,
  usersApp,
  settingsApp,
];

function withAlwaysInstalled(operatorApps: HomeApp[]): HomeApp[] {
  const seen = new Set(operatorApps.map((m) => m.id));
  const merged = [...operatorApps];
  for (const core of ALWAYS_INSTALLED) {
    if (!seen.has(core.id)) merged.push(core);
  }
  return merged;
}

initializeAppRegistry(withAlwaysInstalled(config.apps));

export * from '@rambleraptor/homestead-core/apps/registry';
