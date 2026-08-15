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
import { LoadingBlock } from '@rambleraptor/homestead-core/shared/components/Spinner';

function RouteFallback() {
  return (
    <LoadingBlock size="xl" className="h-64" />
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
    <Suspense key={pathname} fallback={<RouteFallback />}>
      <Component params={match.params} />
    </Suspense>
  );

  for (const gateName of match.route.gates ?? []) {
    element = wrapWithGate(gateName, match.app.id, element);
  }

  return element;
}
