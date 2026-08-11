/**
 * App visibility for navigation and landings — the replacement for the retired
 * per-app `enabled` flag. Two independent gates:
 *
 *   1. **Superuser-only apps** (any whose route carries the `superuser` gate)
 *      are hidden from non-superusers. This is a *hard* rule, independent of the
 *      permission resolver — admin surfaces must never leak into a regular
 *      user's nav, even in the fail-open window where `can()` is permissive.
 *   2. Every other app is filtered by the permission resolver via `can()`: an
 *      app shows if the viewer can read its primary collection. A default
 *      (open-household) household sees every feature app; once access is
 *      narrowed, an app the viewer can't reach drops out of nav.
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
export function primaryResource(app: AppConfig): string | undefined {
  const defs = typeof app.resources === 'function' ? app.resources() : app.resources ?? [];
  return defs[0]?.singular;
}

/**
 * Whether `app` should be visible to a viewer, given a `canRead(resourceType,
 * appId)` capability check and whether the viewer is a superuser. This is the
 * pure core shared by the nav (`useAppVisible`) and the admin access summary,
 * so both agree.
 *
 * Nesting: a parent app is visible if the viewer can open it directly **or** can
 * open any descendant. So access to a nested child (e.g. Pictionary) surfaces
 * its parent (Games) in the nav, and a parent whose children are all out of
 * reach drops out — a parent app that owns no collections of its own would
 * otherwise always show, since it has no primary resource to gate on.
 */
export function isAppVisible(
  app: AppConfig,
  isSuperuser: boolean,
  canRead: (resourceType: string, appId: string) => boolean,
): boolean {
  if (isSuperuserOnlyApp(app)) return isSuperuser;
  const children = app.children ?? [];
  const anyChildVisible = children.some((child) => isAppVisible(child, isSuperuser, canRead));
  const primary = primaryResource(app);
  // Pass the app id so an app-scope grant/deny (e.g. blocking someone from an
  // app) is honored here, matching the engine.
  if (primary) return canRead(primary, app.id) || anyChildVisible;
  // No own resource: a pure parent shows iff a child does; a plain landing-only
  // app (no resources and no children) stays visible.
  return children.length > 0 ? anyChildVisible : true;
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
      return isAppVisible(app, user.type === 'superuser', (resourceType, appId) =>
        can('read', resourceType, { appId }),
      );
    },
    [user, can],
  );
}
