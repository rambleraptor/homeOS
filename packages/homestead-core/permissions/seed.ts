/**
 * Boot-time seeding of the permissions baseline (design §8).
 *
 * Three things are seeded, each **only when its collection is empty** so a
 * household that has since tightened access is never clobbered on the next
 * boot:
 *   1. The built-in role *definitions* (`admin` / `member` / `guest`) — inert
 *      templates, assigned via groups when wanted.
 *   2. The built-in *groups* (`Admins` / `Members` / `Guests`), each conferring
 *      the matching role. A user only gets a role by being in a role-bearing
 *      group, so these are what make role assignment reachable from the
 *      create-user UI on day one — with no groups there is nothing to assign.
 *   3. The open-household grant (`everyone → write on *`) — the explicit form of
 *      today's "everyone reads/writes everything" behavior. Narrowing or
 *      deleting this grant is how an admin later locks things down.
 *
 * Runs from schema-sync after the resource definitions are applied, using the
 * same minted admin token.
 */

import { ROLES, GROUPS, ACCESS_GRANTS } from './resources';

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

export const OPEN_GRANT_ID = 'open-household';

/**
 * The open-household default: everyone can write everything. `is_default: true`
 * marks it a *fallback* — the store drops it for any user who has a conferred
 * role (§8.x), so putting someone in a role-bearing group defines their access
 * outright, without deleting this grant.
 */
export const OPEN_GRANT = {
  subject_type: 'everyone',
  target_scope: 'all',
  capability: 'write',
  effect: 'allow',
  is_default: true,
} as const;

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
 * Seed the baseline roles and open grant. Idempotent: seeds each collection
 * only when it is currently empty. `fetchImpl` defaults to global fetch (boot);
 * tests inject one that routes to an in-process engine.
 */
export async function seedPermissions(
  aepbaseUrl: string,
  token: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ rolesSeeded: number; groupsSeeded: number; openGrantSeeded: boolean }> {
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

  let openGrantSeeded = false;
  if (await isEmpty(fetchImpl, aepbaseUrl, token, ACCESS_GRANTS)) {
    await create(fetchImpl, aepbaseUrl, token, ACCESS_GRANTS, OPEN_GRANT_ID, OPEN_GRANT);
    openGrantSeeded = true;
  } else {
    // Backfill: a household seeded before `is_default` existed has an
    // open-household grant without the marker, so it wouldn't be suppressed for
    // role-holders (roles would silently do nothing). Mark it. Idempotent.
    await ensureOpenGrantDefault(fetchImpl, aepbaseUrl, token);
  }

  return { rolesSeeded, groupsSeeded, openGrantSeeded };
}

/**
 * Ensure the open-household grant carries `is_default: true`. No-ops when the
 * grant is absent (a household that deliberately locked down) or already marked.
 */
async function ensureOpenGrantDefault(
  fetchImpl: FetchLike,
  aepbaseUrl: string,
  token: string,
): Promise<void> {
  const res = await fetchImpl(`${aepbaseUrl}/${ACCESS_GRANTS}/${OPEN_GRANT_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return; // no open grant → nothing to backfill
  const body = (await res.json()) as { is_default?: boolean };
  if (body.is_default === true) return;
  const patch = await fetchImpl(`${aepbaseUrl}/${ACCESS_GRANTS}/${OPEN_GRANT_ID}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_default: true }),
  });
  if (!patch.ok) {
    throw new Error(`PATCH /${ACCESS_GRANTS}/${OPEN_GRANT_ID} → ${patch.status}: ${await patch.text()}`);
  }
}
