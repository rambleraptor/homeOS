/**
 * Which collections the built-in household roles cover, and how.
 *
 * The seeded `admin` / `member` roles used to confer one `all`-scope grant —
 * "everything, forever". That blanket is what made a per-resource opt-out
 * necessary in the first place: a collection that wanted to be private had no
 * way to say "not me", so it said so in its definition instead. Enumerating the
 * roles removes the blanket, and with it the need for the opt-out.
 *
 * A household role covers a collection in one of two shapes:
 *   - **shared** — a plain collection grant. Every household member sees and
 *     edits every row. This is almost everything.
 *   - **own rows only** — the same grant carrying a `created_by == subject.id`
 *     filter, so a member may add rows and reach their own, but not anyone
 *     else's. Row visibility for the owner actually comes from `_owner`
 *     (owner ⇒ manage, engine-set and reliable even when `created_by` is
 *     absent); the filter's real job is to authorize CREATE without opening
 *     everyone else's rows.
 *
 * Privacy is therefore the shape of a grant, in one list here, rather than a
 * keyword scattered across resource definitions.
 */

import type { ResourceDefinition } from '../resources/types';
import type { AppConfig } from '../apps/types';

/** Scopes a grant to rows the caller created. See {@link PRIVATE_COLLECTIONS}. */
export const OWN_ROWS_FILTER = 'created_by == subject.id';

/**
 * Collections a household role covers **only for the member's own rows**, so
 * they stay private until explicitly shared.
 *
 * Keep this list short and justified — every entry is a collection whose rows
 * an ordinary household member cannot see, which is a surprise unless the app
 * makes it obvious. Today that is the documents app, whose whole point is
 * per-folder sharing: a document is visible to its owner plus whoever holds a
 * record grant, or the collection-scope grant that sharing a folder writes.
 */
export const PRIVATE_COLLECTIONS: readonly string[] = ['document', 'collection'];

/**
 * Household collections the engine manages itself, so they never appear in any
 * app's declared definitions but still need covering. `app-flag` is the
 * household-wide settings singleton, built at boot from the flags apps declare.
 */
const ENGINE_MANAGED_SHARED: readonly string[] = ['app-flag'];

/**
 * The permissions data model governs its own access by the manage-on-target
 * rule (design §15.3) rather than by ordinary grants, so a role grant over these
 * would be inert at best and confusing at worst.
 */
const SELF_GOVERNING: readonly string[] = [
  'role',
  'group',
  'group-membership',
  'access-grant',
];

/** One collection a household role covers, and the filter (if any) scoping it. */
export interface HouseholdCollection {
  resource_type: string;
  /** Present only for {@link PRIVATE_COLLECTIONS}. */
  filter?: string;
}

/**
 * Compute the collections a household role should confer, in stable (sorted)
 * order.
 *
 * Excluded entirely, in order of why:
 *   - **user-parented** resources (notifications, preferences, tokens,
 *     favorites) — the router governs these by `checkUserScope` (subtree
 *     ownership by path) and skips grant enforcement, so a grant would do
 *     nothing at all;
 *   - the **self-governing** permission resources (above).
 *
 * Everything else a household declares — including child collections like
 * `transaction` or `perk`, which need their own grant because a grant matches
 * one `resource_type` — is covered, shared or own-rows-only.
 */
export function householdCollections(
  defs: readonly ResourceDefinition[],
): HouseholdCollection[] {
  const excluded = new Set(SELF_GOVERNING);
  const priv = new Set(PRIVATE_COLLECTIONS);
  const names = new Set<string>(ENGINE_MANAGED_SHARED);
  for (const def of defs) {
    // `parents` names singulars; `user` is aepbase's built-in root.
    if (def.parents?.includes('user')) continue;
    if (excluded.has(def.singular)) continue;
    names.add(def.singular);
  }
  return [...names]
    .sort()
    .map((resource_type) =>
      priv.has(resource_type) ? { resource_type, filter: OWN_ROWS_FILTER } : { resource_type },
    );
}

/**
 * Apps that are part of the shell rather than the household's data, and so are
 * visible to everyone — including an account granted nothing at all.
 *
 * Settings is where you manage *your own* preferences and notifications. Gating
 * it behind a grant would leave a Guest with no way to reach their own settings,
 * which is a worse failure than the openness is a risk: there is no household
 * data behind it. Everything else collection-less (Chat, Dashboard) is granted
 * normally.
 *
 * Deliberately unconditional — not "visible unless denied". If blocking someone
 * from Settings ever becomes a real requirement, that's a feature to design, not
 * a default to lean on.
 */
export const ALWAYS_VISIBLE_APPS: readonly string[] = ['settings'];

/**
 * Apps whose visibility can only be granted at app scope: they own no
 * collections and have no children, so there is nothing else to gate on (Chat,
 * Dashboard). Without a grant they'd be invisible to everyone once the sidebar
 * stopped defaulting them to visible, so the household roles carry one app-scope
 * grant each. {@link ALWAYS_VISIBLE_APPS} are skipped — they need no grant.
 *
 * Superuser-gated apps are left out: `isAppVisible` hard-gates them on account
 * type regardless, so a grant would be inert and would only make the role
 * listing misleading. The gate is read inline rather than imported from
 * `apps/useAppVisibility` — that module pulls in React, and this one runs in the
 * boot-time seeder.
 */
export function householdApps(apps: readonly AppConfig[]): string[] {
  const out: string[] = [];
  const visit = (app: AppConfig): void => {
    for (const child of app.children ?? []) visit(child);
    const superuserOnly = (app.web?.routes ?? []).some((r) =>
      (r.gates ?? []).includes('superuser'),
    );
    if (superuserOnly) return;
    if (ALWAYS_VISIBLE_APPS.includes(app.id)) return; // visible without a grant
    const defs = typeof app.resources === 'function' ? app.resources() : app.resources ?? [];
    if (defs.length > 0) return; // gated by its collections
    if ((app.children ?? []).length > 0) return; // gated by its children
    out.push(app.id);
  };
  for (const app of apps) visit(app);
  return out.sort();
}
