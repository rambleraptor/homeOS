/**
 * The always-installed core apps and the helper that merges them into
 * an operator's app list.
 *
 * Kept out of `registry.ts` on purpose: that file imports zero `HomeApp`
 * instances so a bare `import` stays type-only (see the note at the top of
 * registry.ts). This app is the one place that names the core apps, so
 * every consumer that boots the registry from a config (the SPA shim, the
 * sidecar, and the launcher's app-access serializer) shares one list and
 * can't drift.
 */

import { settingsApp } from '../settings/app.config';
import { superuserApp } from '../superuser/app.config';
import { usersApp } from '../users/app.config';
import type { HomeApp } from './types';

/**
 * Apps every instance ships regardless of the operator's config. Their
 * collections are part of the core experience and are never gated by the
 * backend app-access middleware (aepbase's own user-parenting protects
 * the user-scoped ones).
 */
export const ALWAYS_INSTALLED_APPS: HomeApp[] = [
  superuserApp,
  usersApp,
  settingsApp,
];

/** Ids of the always-installed core apps. */
export const ALWAYS_INSTALLED_APP_IDS: string[] = ALWAYS_INSTALLED_APPS.map(
  (m) => m.id,
);

/**
 * Append the always-installed core apps to an operator's app list,
 * skipping any the operator already declared (matched by id).
 */
export function withAlwaysInstalled(operatorApps: HomeApp[]): HomeApp[] {
  const seen = new Set(operatorApps.map((m) => m.id));
  const merged = [...operatorApps];
  for (const core of ALWAYS_INSTALLED_APPS) {
    if (!seen.has(core.id)) merged.push(core);
  }
  return merged;
}
