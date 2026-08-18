/**
 * Boot-time seeding of the permissions baseline (design §8).
 *
 * Two things are seeded, each **only when its collection is empty** so a
 * household that has since curated its own access is never clobbered on the
 * next boot:
 *   1. The built-in role *definitions* (`admin` / `member` / `guest`) — inert
 *      templates, assigned via groups when wanted.
 *   2. The built-in *groups* (`Admins` / `Members` / `Guests`), each conferring
 *      the matching role. A user only gets a role by being in a role-bearing
 *      group, so these are what make role assignment reachable from the
 *      create-user UI on day one — with no groups there is nothing to assign.
 *
 * **No grant is seeded, and no grant anywhere is `all`-scope.** A household
 * starts closed: the resolver denies by default (`resolve()` ends in
 * `no-grant`), so a person's access comes entirely from the role their group
 * confers, plus anything shared with them directly. The built-in roles name the
 * collections they cover one by one (see `household.ts`), so a collection is
 * private exactly when no role names it — there is no blanket to opt out of.
 *
 * Because the covered set is derived from what a household has *installed*, the
 * built-in roles are reconciled on every boot: install an app and its
 * collections join the household roles; remove one and they drop out. That makes
 * `admin` and `member` platform-managed — an edit to either is overwritten on
 * the next boot. A household that wants a different access level creates its own
 * role, which is never touched.
 *
 * Instances seeded before this carry an `everyone → write on *` grant
 * (`OPEN_GRANT_ID`) that made every account read/write everything. The
 * `permissions-close-open-default` migration retires it, moving anyone who was
 * riding it onto the Member role first — see
 * `permissions/migrations/close-open-default.ts`.
 *
 * Runs from schema-sync after the resource definitions are applied, using the
 * same minted admin token.
 */

import { ROLES, GROUPS } from './resources';
import type { HouseholdCollection } from './household';

export interface SeedRoleGrant {
  target_scope: 'collection';
  resource_type: string;
  capability: 'read' | 'write' | 'manage';
  /** Scopes the grant to a subset of rows; see `household.ts`. */
  filter?: string;
}

export interface SeedRole {
  id: string;
  name: string;
  description: string;
  grants: SeedRoleGrant[];
}

/** One collection-scope grant per covered collection, in the given capability. */
export function householdRoleGrants(
  collections: readonly HouseholdCollection[],
  capability: 'read' | 'write' | 'manage',
): SeedRoleGrant[] {
  return collections.map(({ resource_type, filter }) => ({
    target_scope: 'collection' as const,
    resource_type,
    capability,
    ...(filter ? { filter } : {}),
  }));
}

/**
 * The built-in roles for a household covering `collections`.
 *
 * `admin` and `member` differ only in capability — `manage` adds the ability to
 * share what they can already see. `guest` is deliberately empty: a guest gets
 * exactly what someone shares with them, one record at a time.
 */
export function buildSeedRoles(collections: readonly HouseholdCollection[]): SeedRole[] {
  return [
    {
      id: 'admin',
      name: 'Admin',
      description:
        'Read, write, and share everything in the household (without being a superuser account).',
      grants: householdRoleGrants(collections, 'manage'),
    },
    {
      id: 'member',
      name: 'Member',
      description: 'Read and write everything in the household.',
      grants: householdRoleGrants(collections, 'write'),
    },
    {
      id: 'guest',
      name: 'Guest',
      description: 'No access until someone shares something with them.',
      grants: [],
    },
  ];
}

export interface SeedGroup {
  id: string;
  name: string;
  description: string;
  /** The role conferred on every member of this group (role id reference). */
  role: string;
}

/**
 * One group per built-in role, so the create-user UI can offer "Access level:
 * Admin / Member / Guest" out of the box. Adding a user to one of these groups
 * is what confers its role — and a role is the only way an ordinary account gets
 * access to anything.
 */
export const SEED_GROUPS: SeedGroup[] = [
  {
    id: 'admins',
    name: 'Admins',
    description: 'Full control of everything (via the Admin role).',
    role: 'admin',
  },
  {
    id: 'members',
    name: 'Members',
    description: 'Read and write household data (via the Member role).',
    role: 'member',
  },
  {
    id: 'guests',
    name: 'Guests',
    description: 'No access until an admin grants some (via the Guest role).',
    role: 'guest',
  },
];

/**
 * Id of the retired open-household grant (`everyone → write on *`).
 *
 * No longer seeded — a household starts closed. The id survives because
 * instances seeded before the change still carry the row, and the
 * `permissions-close-open-default` migration needs to find and delete it.
 */
export const OPEN_GRANT_ID = 'open-household';

/** The fetch signature the seeder needs — injectable so tests can route to an in-process engine. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function isEmpty(
  fetchImpl: FetchLike,
  aepbaseUrl: string,
  token: string,
  plural: string,
): Promise<boolean> {
  const res = await fetchImpl(`${aepbaseUrl}/${plural}?max_page_size=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /${plural} → ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { results?: unknown[] };
  return (body.results ?? []).length === 0;
}

async function create(
  fetchImpl: FetchLike,
  aepbaseUrl: string,
  token: string,
  plural: string,
  id: string,
  body: unknown,
): Promise<void> {
  const res = await fetchImpl(`${aepbaseUrl}/${plural}?id=${id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // 409 = already present (a concurrent boot won the race); treat as seeded.
  if (!res.ok && res.status !== 409) {
    throw new Error(`POST /${plural}?id=${id} → ${res.status}: ${await res.text()}`);
  }
}

/** PATCH one record; used to reconcile a built-in role's grant list. */
async function patch(
  fetchImpl: FetchLike,
  aepbaseUrl: string,
  token: string,
  plural: string,
  id: string,
  body: unknown,
): Promise<void> {
  const res = await fetchImpl(`${aepbaseUrl}/${plural}/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`PATCH /${plural}/${id} → ${res.status}: ${await res.text()}`);
  }
}

/** Read one record, or null when it isn't there. */
async function read(
  fetchImpl: FetchLike,
  aepbaseUrl: string,
  token: string,
  plural: string,
  id: string,
): Promise<Record<string, unknown> | null> {
  const res = await fetchImpl(`${aepbaseUrl}/${plural}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

/** Same collections, same capabilities — order-insensitive. */
function grantsMatch(a: SeedRoleGrant[], b: unknown): boolean {
  if (!Array.isArray(b) || b.length !== a.length) return false;
  const key = (g: { resource_type?: unknown; capability?: unknown; filter?: unknown }) =>
    `${String(g.resource_type)}:${String(g.capability)}:${String(g.filter ?? '')}`;
  const have = new Set((b as SeedRoleGrant[]).map(key));
  return a.every((g) => have.has(key(g)));
}

/**
 * Seed the baseline roles and groups, then reconcile the built-in roles against
 * the collections this household currently declares. `fetchImpl` defaults to
 * global fetch (boot); tests inject one that routes to an in-process engine.
 *
 * Deliberately seeds **no grants** — see the module header. A freshly seeded
 * household grants nothing to anybody; the superuser who claimed the instance
 * breaks glass past enforcement and hands out access from there.
 *
 * `collections` is the household-shared set computed by
 * `householdCollections` in `./household`. Reconciling it every boot is what
 * keeps a newly installed app reachable without anyone editing a role by hand.
 */
export async function seedPermissions(
  aepbaseUrl: string,
  token: string,
  fetchImpl: FetchLike = fetch,
  collections: readonly HouseholdCollection[] = [],
): Promise<{ rolesSeeded: number; groupsSeeded: number; rolesReconciled: string[] }> {
  const seedRoles = buildSeedRoles(collections);

  let rolesSeeded = 0;
  if (await isEmpty(fetchImpl, aepbaseUrl, token, ROLES)) {
    for (const role of seedRoles) {
      const { id, ...fields } = role;
      await create(fetchImpl, aepbaseUrl, token, ROLES, id, fields);
      rolesSeeded += 1;
    }
  }

  // Reconcile the *built-in* roles only (`guest` carries no grants, so there is
  // nothing to reconcile). A role a household made itself is never touched —
  // it isn't in `seedRoles`.
  const rolesReconciled: string[] = [];
  if (rolesSeeded === 0) {
    for (const role of seedRoles) {
      if (role.grants.length === 0) continue;
      const existing = await read(fetchImpl, aepbaseUrl, token, ROLES, role.id);
      // A built-in role an admin deleted stays deleted; we don't resurrect it.
      if (!existing) continue;
      if (grantsMatch(role.grants, existing.grants)) continue;
      await patch(fetchImpl, aepbaseUrl, token, ROLES, role.id, { grants: role.grants });
      rolesReconciled.push(role.id);
    }
  }

  // The role-bearing groups the create-user UI assigns. Seeded only when the
  // groups collection is empty, so a household that has curated its own groups
  // (or deliberately deleted these) is never re-seeded.
  let groupsSeeded = 0;
  if (await isEmpty(fetchImpl, aepbaseUrl, token, GROUPS)) {
    for (const group of SEED_GROUPS) {
      const { id, ...fields } = group;
      await create(fetchImpl, aepbaseUrl, token, GROUPS, id, fields);
      groupsSeeded += 1;
    }
  }

  return { rolesSeeded, groupsSeeded, rolesReconciled };
}
