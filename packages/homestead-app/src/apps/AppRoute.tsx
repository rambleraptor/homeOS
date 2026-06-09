/**
 * Catch-all app renderer for the SPA.
 *
 * React Router hands us the current path; we resolve it to an app route
 * via the shared matcher, lazily load the route component, and wrap it in
 * any declared gates — the client-side equivalent of the old Next
 * `(app)/[...slug]/page.tsx` server component.
 */

import { Suspense, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getAllApps } from '@/apps/registry';
import {
  buildRouteEntries,
  matchRoute,
} from '@rambleraptor/homestead-core/apps/router/match';
import { gateComponents } from '@rambleraptor/homestead-core/apps/router/gates';
import { getLazyComponent } from '@rambleraptor/homestead-core/apps/lazy';
import { NotFound } from '@rambleraptor/homestead-core/router/NotFound';

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
  let element = (
    <Suspense key={pathname} fallback={<RouteFallback />}>
      <Component params={match.params} />
    </Suspense>
  );

  for (const gateName of match.route.gates ?? []) {
    const Gate = gateComponents[gateName];
    element = <Gate appId={match.app.id}>{element}</Gate>;
  }

  return element;
}
