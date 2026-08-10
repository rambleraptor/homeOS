import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { fetchPermissionContext } from '@rambleraptor/homestead-core/permissions/client';
import type { Capability } from '@rambleraptor/homestead-core/permissions/resolve';

/** A target the caller can grant a token, and the strongest capability they hold on it. */
export interface ScopeOption {
  key: string;
  label: string;
  target_scope: 'all' | 'app' | 'collection';
  target_app?: string;
  resource_type?: string;
  maxCapability: Capability;
}

const CAP_RANK: Record<Capability, number> = { read: 1, write: 2, manage: 3 };
const PICKABLE_SCOPES = new Set(['all', 'app', 'collection']);

function labelFor(scope: string, app?: string, resource?: string): string {
  if (scope === 'all') return 'Everything';
  if (scope === 'app') return `App: ${app}`;
  return `Collection: ${resource}`;
}

/**
 * The scopes the current user may assign to a token: derived from their own
 * applicable allow-grants, so the picker can never offer more than the owner
 * holds (the server enforces the same bound at request time). A superuser gets
 * a single "Everything · manage" option, since they hold no explicit grants.
 */
export function useTokenScopeOptions() {
  return useQuery({
    queryKey: ['settings', 'token-scope-options'],
    queryFn: async (): Promise<ScopeOption[]> => {
      const user = aepbase.getCurrentUser();
      const token = aepbase.authStore.token;
      if (!user) return [];

      if (user.type === 'superuser') {
        return [
          {
            key: 'all:',
            label: labelFor('all'),
            target_scope: 'all',
            maxCapability: 'manage',
          },
        ];
      }

      const ctx = await fetchPermissionContext(token);
      if (!ctx) return [];

      const groupIds = new Set(ctx.groupIds);
      const byKey = new Map<string, ScopeOption>();
      for (const g of ctx.grants) {
        if (g.effect !== 'allow') continue;
        const s = g.subject;
        const matches =
          s.type === 'everyone' ||
          (s.type === 'user' && s.id === user.id) ||
          (s.type === 'group' && s.id !== undefined && groupIds.has(s.id));
        if (!matches) continue;
        const scope = g.target.scope;
        if (!PICKABLE_SCOPES.has(scope)) continue; // skip record/filter grants

        const key = `${scope}:${g.target.app ?? ''}:${g.target.resource_type ?? ''}`;
        const existing = byKey.get(key);
        if (existing && CAP_RANK[existing.maxCapability] >= CAP_RANK[g.capability]) continue;
        byKey.set(key, {
          key,
          label: labelFor(scope, g.target.app, g.target.resource_type),
          target_scope: scope as ScopeOption['target_scope'],
          target_app: g.target.app,
          resource_type: g.target.resource_type,
          maxCapability: g.capability,
        });
      }
      return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
    },
  });
}

/** Capabilities up to and including a ceiling (for the per-scope capability picker). */
export function capabilitiesUpTo(max: Capability): Capability[] {
  return (['read', 'write', 'manage'] as Capability[]).filter(
    (c) => CAP_RANK[c] <= CAP_RANK[max],
  );
}
