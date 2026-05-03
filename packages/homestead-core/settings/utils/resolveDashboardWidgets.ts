/**
 * Resolve the effective dashboard widget list for a user.
 *
 * Inputs:
 *   - `available`: every widget contributed by registered modules,
 *     pre-sorted by their declared `order` (the registry already does
 *     this in `getAllDashboardWidgets`).
 *   - `preferredOrder`: ids the user has placed in their preferred
 *     order via the settings UI. Ids no longer present in `available`
 *     are dropped (e.g. a module was removed); ids present in
 *     `available` but not in `preferredOrder` get appended to the end
 *     in their default order so newly registered widgets are surfaced
 *     to existing users instead of vanishing.
 *   - `hidden`: ids the user has explicitly hidden. Filtered out
 *     after the order is resolved.
 */

import type { DashboardWidget } from '@/modules/types';

export function resolveDashboardWidgets(
  available: DashboardWidget[],
  preferredOrder: string[] | undefined,
  hidden: string[] | undefined,
): DashboardWidget[] {
  const byId = new Map(available.map((w) => [w.id, w]));
  const hiddenSet = new Set(hidden ?? []);

  const ordered: DashboardWidget[] = [];
  const seen = new Set<string>();

  for (const id of preferredOrder ?? []) {
    const widget = byId.get(id);
    if (widget && !seen.has(id)) {
      ordered.push(widget);
      seen.add(id);
    }
  }
  for (const widget of available) {
    if (!seen.has(widget.id)) {
      ordered.push(widget);
      seen.add(widget.id);
    }
  }

  return ordered.filter((w) => !hiddenSet.has(w.id));
}
