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
 * **No grant is seeded.** A household starts closed: the resolver denies by
 * default (`resolve()` ends in `no-grant`), so a person's access comes entirely
 * from the role their group confers, plus anything shared with them directly.
 * Access is something you hand out, never something you have to remember to
 * take away.
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

export interface SeedRole {
  id: string;
  name: string;
  description: string;
  grants: Array<{
    target_scope: 'all' | 'app' | 'collection';
    target_app?: string;
    resource_type?: string;
    filter?: string;
    capability: 'read' | 'write' | 'manage';
  }>;
}

export const SEED_ROLES: SeedRole[] = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Full control of everything (without being a superuser account).',
    grants: [{ target_scope: 'all', capability: 'manage' }],
  },
  {
    id: 'member',
    name: 'Member',
    description: 'Read and write everything in the household.',
    grants: [{ target_scope: 'all', capability: 'write' }],
  },
  {
    id: 'guest',
    name: 'Guest',
    description: 'No access until an admin grants some.',
    grants: [],
  },
];

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
 * confers its role and suppresses the open-household default for them.
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

/**
 * Seed the baseline roles and groups. Idempotent: seeds each collection only
 * when it is currently empty. `fetchImpl` defaults to global fetch (boot);
 * tests inject one that routes to an in-process engine.
 *
 * Deliberately seeds **no grants** — see the module header. A freshly seeded
 * household grants nothing to anybody; the superuser who claimed the instance
 * breaks glass past enforcement and hands out access from there.
 */
export async function seedPermissions(
  aepbaseUrl: string,
  token: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ rolesSeeded: number; groupsSeeded: number }> {
  let rolesSeeded = 0;
  if (await isEmpty(fetchImpl, aepbaseUrl, token, ROLES)) {
    for (const role of SEED_ROLES) {
      const { id, ...fields } = role;
      await create(fetchImpl, aepbaseUrl, token, ROLES, id, fields);
      rolesSeeded += 1;
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

  return { rolesSeeded, groupsSeeded };
}
