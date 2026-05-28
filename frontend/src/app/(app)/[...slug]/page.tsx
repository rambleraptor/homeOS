import type { ComponentType } from 'react';
import { notFound } from 'next/navigation';
import { getAllModules } from '@/modules/registry';
import { buildRouteEntries, matchRoute } from '@rambleraptor/homestead-core/modules/router/match';
import { gateComponents } from '@rambleraptor/homestead-core/modules/router/gates';
import type { ModuleRouteProps } from '@rambleraptor/homestead-core/modules/types';

export function generateStaticParams() {
  const entries = buildRouteEntries(getAllModules());
  return entries
    .filter((e) => !e.route.dynamic)
    .map((e) => ({ slug: e.segments }));
}

export default async function ModuleCatchAll({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const entries = buildRouteEntries(getAllModules());
  const match = matchRoute(slug, entries);
  if (!match) notFound();

  // Route components are declared as lazy thunks; this server component
  // resolves the import directly (no React.lazy needed off the server).
  const loaded = await match.route.component();
  const Component: ComponentType<ModuleRouteProps> =
    'default' in loaded ? loaded.default : loaded;
  let element = <Component params={match.params} />;

  for (const gateName of match.route.gates ?? []) {
    const Gate = gateComponents[gateName];
    element = <Gate moduleId={match.module.id}>{element}</Gate>;
  }

  return element;
}
