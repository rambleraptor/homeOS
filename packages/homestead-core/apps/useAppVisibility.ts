/**
 * App visibility for navigation and landings — the replacement for the retired
 * per-app `enabled` flag. Two independent gates:
 *
 *   1. **Superuser-only apps** (any whose route carries the `superuser` gate)
 *      are hidden from non-superusers. This is a *hard* rule, independent of
 *      permission enforcement — admin surfaces must never leak into a regular
 *      user's nav, even when `PERMISSIONS_ENFORCED` is off (where `can()` is
 *      permissive).
 *   2. Every other app is filtered by the permission resolver via `can()`: an
 *      app shows if the viewer can read its primary collection. With enforcement
 *      off `can()` is permissive, so a default household sees every feature app;
 *      with it on, an app the viewer can't reach drops out of nav.
 */

import { useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { useCan } from '../permissions/useCan';
import type { AppConfig } from './types';

/** An app is superuser-only iff any of its routes carries the `superuser` gate. */
export function isSuperuserOnlyApp(app: AppConfig): boolean {
  return (app.web?.routes ?? []).some((r) => (r.gates ?? []).includes('superuser'));
}

/** An app's primary (first declared) resource singular, if it has one. */
function primaryResource(app: AppConfig): string | undefined {
  const defs = typeof app.resources === 'function' ? app.resources() : app.resources ?? [];
  return defs[0]?.singular;
}

/**
 * Returns a predicate `(app) => boolean` for whether the current viewer should
 * see an app in navigation / landing pages. See the module doc for the rules.
 */
export function useAppVisible(): (app: AppConfig) => boolean {
  const { user } = useAuth();
  const can = useCan();
  return useCallback(
    (app: AppConfig): boolean => {
      if (!user) return false;
      if (isSuperuserOnlyApp(app)) return user.type === 'superuser';
      const primary = primaryResource(app);
      return !primary || can('read', primary);
    },
    [user, can],
  );
}
