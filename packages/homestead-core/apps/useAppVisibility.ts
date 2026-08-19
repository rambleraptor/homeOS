/**
 * App visibility for navigation and landings — the replacement for the retired
 * per-app `enabled` flag. Two independent gates:
 *
 *   1. **Superuser-only apps** (any whose route carries the `superuser` gate)
 *      are hidden from non-superusers. This is a *hard* rule, independent of the
 *      permission resolver — admin surfaces must never leak into a regular
 *      user's nav.
 *   2. Every other app is filtered by the permission resolver: an app shows if
 *      the viewer can reach **any** collection it owns. A household is closed by
 *      default, so what a viewer sees is exactly what their role grants.
 *
 * "Reach" is deliberately broader than "the grants say read". A collection
 * behind a *filtered* grant (your own documents) can't be resolved client-side —
 * `canWith` passes no `filterEval` — so the server also reports which
 * collections the viewer has at least one visible row of
 * (`PermissionContext.collectionsWithRows`), and callers fold that into the
 * `canRead` they pass here. Without it an app you can genuinely use looks
 * unreachable and vanishes from the sidebar.
 *
 * An app owning **no** collections has nothing to gate on, so visibility is a
 * property of the app itself: an app-scope grant decides. The built-in household
 * roles carry those grants (see `permissions/household.ts`), so a Member keeps
 * seeing Chat while a Guest, granted nothing, does not. The exception is
 * `ALWAYS_VISIBLE_APPS` — Settings manages your *own* preferences, so gating it
 * would strand an account with no way to reach its own settings.
 */

import { useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { useCan } from '../permissions/useCan';
import { ALWAYS_VISIBLE_APPS } from '../permissions/household';
import type { AppConfig } from './types';

/** An app is superuser-only iff any of its routes carries the `superuser` gate. */
export function isSuperuserOnlyApp(app: AppConfig): boolean {
  return (app.web?.routes ?? []).some((r) => (r.gates ?? []).includes('superuser'));
}

/**
 * Sentinel resource type for an app that owns no collections. It matches no
 * collection- or record-scope grant, so only an `app`-scope grant (or a blanket
 * `all`-scope one) can make such an app visible — which is exactly the question
 * being asked.
 */
export const APP_ITSELF = '__app__';

/** Every collection singular an app owns, in declaration order. */
export function appResources(app: AppConfig): string[] {
  const defs = typeof app.resources === 'function' ? app.resources() : app.resources ?? [];
  return defs.map((d) => d.singular);
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
  // Shell apps holding no household data — reachable by anyone signed in.
  if (ALWAYS_VISIBLE_APPS.includes(app.id)) return true;

  const children = app.children ?? [];
  if (children.some((child) => isAppVisible(child, isSuperuser, canRead))) return true;

  // Any collection the app owns will do — gating on the *first* declared one
  // would hide an app whose second resource is the one you can reach. The app id
  // rides along so an app-scope grant or deny is honored, matching the engine.
  const resources = appResources(app);
  if (resources.length > 0) return resources.some((r) => canRead(r, app.id));

  // A pure parent with no collections of its own is exactly its children.
  if (children.length > 0) return false;

  // Nothing to gate on but the app itself.
  return canRead(APP_ITSELF, app.id);
}

/**
 * Returns a predicate `(app) => boolean` for whether the current viewer should
 * see an app in navigation / landing pages. See the module doc for the rules.
 */
export function useAppVisible(): (app: AppConfig) => boolean {
  const { user } = useAuth();
  const can = useCan();
  const withRows = user?.permissions?.collectionsWithRows;
  return useCallback(
    (app: AppConfig): boolean => {
      if (!user) return false;
      const reachable = new Set(withRows ?? []);
      return isAppVisible(app, user.type === 'superuser', (resourceType, appId) =>
        can('read', resourceType, { appId }) || reachable.has(resourceType),
      );
    },
    [user, can, withRows],
  );
}
