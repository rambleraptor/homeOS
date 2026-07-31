/**
 * Boot-time seeding of the permissions baseline (design §8).
 *
 * Two things are seeded, both **only when their collection is empty** so a
 * household that has since tightened access is never clobbered on the next
 * boot:
 *   1. The built-in role *definitions* (`admin` / `member` / `guest`) — inert
 *      templates, assigned via groups when wanted.
 *   2. The open-household grant (`everyone → write on *`) — the explicit form of
 *      today's "everyone reads/writes everything" behavior. Narrowing or
 *      deleting this grant is how an admin later locks things down.
 *
 * Runs from schema-sync after the resource definitions are applied, using the
 * same minted admin token.
 */

import { ROLES, ACCESS_GRANTS } from './resources';

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

export const OPEN_GRANT_ID = 'open-household';

/** The backward-compatible open-household grant: everyone can write everything. */
export const OPEN_GRANT = {
  subject_type: 'everyone',
  target_scope: 'all',
  capability: 'write',
  effect: 'allow',
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
): Promise<{ rolesSeeded: number; openGrantSeeded: boolean }> {
  let rolesSeeded = 0;
  if (await isEmpty(fetchImpl, aepbaseUrl, token, ROLES)) {
    for (const role of SEED_ROLES) {
      const { id, ...fields } = role;
      await create(fetchImpl, aepbaseUrl, token, ROLES, id, fields);
      rolesSeeded += 1;
    }
  }

  let openGrantSeeded = false;
  if (await isEmpty(fetchImpl, aepbaseUrl, token, ACCESS_GRANTS)) {
    await create(fetchImpl, aepbaseUrl, token, ACCESS_GRANTS, OPEN_GRANT_ID, OPEN_GRANT);
    openGrantSeeded = true;
  }

  return { rolesSeeded, openGrantSeeded };
}
