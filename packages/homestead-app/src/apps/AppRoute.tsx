/**
 * Catch-all app renderer for the SPA.
 *
 * React Router hands us the current path; we resolve it to an app route
 * via the shared matcher, lazily load the route component, and wrap it in
 * any declared gates — the client-side equivalent of the old Next
 * `(app)/[...slug]/page.tsx` server component.
 */

import { Suspense, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { getAllApps } from '@/apps/registry';
import {
  buildRouteEntries,
  matchRoute,
} from '@rambleraptor/homestead-core/apps/router/match';
import { wrapWithGate } from '@rambleraptor/homestead-core/apps/router/gates';
import { getLazyComponent } from '@rambleraptor/homestead-core/apps/lazy';
import { NotFound } from '@rambleraptor/homestead-core/router/NotFound';
import {
  ErrorBoundary,
  AppErrorFallback,
} from '@rambleraptor/homestead-core/shared/components/ErrorBoundary';

function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent-terracotta" />
    </div>
  );
}

export function AppRoute() {
  const { pathname } = useLocation();
  const entries = useMemo(() => buildRouteEntries(getAllApps()), []);
  const slug = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const match = matchRoute(slug, entries);

  if (!match) return <NotFound />;

  const Component = getLazyComponent(match.route.component);
  let element: ReactNode = (
    <Suspense fallback={<RouteFallback />}>
      <Component params={match.params} />
    </Suspense>
  );

  for (const gateName of match.route.gates ?? []) {
    element = wrapWithGate(gateName, match.app.id, element);
  }

  // Keyed by pathname so navigating to another route remounts the boundary and
  // clears a prior error. Catches both render exceptions and a rejected lazy
  // chunk import (stale asset hashes after a deploy, or a drop mid-navigation),
  // either of which would otherwise crash the whole SPA to a blank page.
  return (
    <ErrorBoundary key={pathname} fallback={<AppErrorFallback />}>
      {element}
    </ErrorBoundary>
  );
}
