/** Shared test harness: an in-memory Engine with a seeded superuser. */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Engine } from '../../src/engine/engine';
import { __setDefaultKeyPathForTests } from '../../src/engine/crypto';
import { generateId, generateToken, nowRFC3339 } from '../../src/engine/ids';
import { hashPassword, insertToken, insertUser } from '../../src/engine/users';
import type { User } from '../../src/engine/types';
import { TYPE_REGULAR, TYPE_SUPERUSER } from '../../src/engine/types';

export interface TestEngine {
  engine: Engine;
  filesDir: string;
  admin: User;
  adminToken: string;
}

export async function makeEngine(): Promise<TestEngine> {
  // Disable the `~/.homestead/master.key` fallback so a key on the developer's
  // machine never flips an engine test into encryption-on. Tests that want
  // encryption set HOMESTEAD_MASTER_KEY explicitly (inline env wins anyway).
  __setDefaultKeyPathForTests(null);
  const filesDir = mkdtempSync(join(tmpdir(), 'hs-engine-test-'));
  const engine = new Engine({
    dbPath: ':memory:',
    filesDir,
    serverUrl: 'http://localhost:8090',
  });
  const { user: admin, token: adminToken } = await seedUser(engine, {
    email: 'admin@example.com',
    type: TYPE_SUPERUSER,
  });
  return { engine, filesDir, admin, adminToken };
}

export async function seedUser(
  engine: Engine,
  opts: { email: string; type?: string; password?: string },
): Promise<{ user: User; token: string }> {
  const id = generateId();
  const now = nowRFC3339();
  const user: User = {
    id,
    path: `users/${id}`,
    email: opts.email,
    type: opts.type ?? TYPE_REGULAR,
    create_time: now,
    update_time: now,
  };
  insertUser(engine.db, user, await hashPassword(opts.password ?? 'password123'));
  const token = generateToken();
  insertToken(engine.db, token, id);
  return { user, token };
}

export interface RequestOptions {
  token?: string;
  body?: unknown;
  form?: FormData;
  contentType?: string;
  /** Extra request headers, merged after the derived auth/content-type ones. */
  headers?: Record<string, string>;
}

export async function call(
  engine: Engine,
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    headers['Content-Type'] = opts.contentType ?? 'application/json';
  }
  Object.assign(headers, opts.headers ?? {});
  return engine.fetch(new Request(`http://localhost:8090${path}`, { method, headers, body }));
}

/**
 * Define the permission collections and seed the open-household baseline (roles,
 * groups, and the `everyone → write on *` grant), then drop the permission cache
 * so it's honored immediately. Feature tests that aren't *about* permissions use
 * this to opt into a normally-configured household, where a regular user has
 * ordinary CRUD — the production default. Without it the engine is fail-closed,
 * so a grant-less regular user can't create top-level records.
 */
export async function seedOpenHousehold(t: TestEngine): Promise<void> {
  const { PERMISSION_RESOURCE_DEFS } = await import(
    '@rambleraptor/homestead-core/permissions/resources'
  );
  const { toWireSchema } = await import('@rambleraptor/homestead-core/resources/translate');
  const { seedPermissions } = await import('@rambleraptor/homestead-core/permissions/seed');
  for (const def of PERMISSION_RESOURCE_DEFS) {
    await defineResource(
      t,
      {
        singular: def.singular,
        plural: def.plural,
        parents: def.parents ?? [],
        superuser_write: def.superuser_write ?? false,
        schema: toWireSchema(def.fields, def.singular),
      },
      def.singular,
    );
  }
  await seedPermissions('http://localhost:8090', t.adminToken, (input, init) =>
    t.engine.fetch(new Request(input, init)),
  );
  // The store may have cached an empty grant set during the seeding writes;
  // clear it so the just-seeded open grant is visible on the next request.
  t.engine.reloadPermissions();
}

/** Create a resource definition through the meta API. */
export async function defineResource(
  t: TestEngine,
  def: Record<string, unknown>,
  id?: string,
): Promise<Response> {
  const q = id ? `?id=${id}` : '';
  return call(t.engine, 'POST', `/aep-resource-definitions${q}`, {
    token: t.adminToken,
    body: def,
  });
}

export const BOOK_DEF = {
  singular: 'book',
  plural: 'books',
  user_settable_create: true,
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      pages: { type: 'integer' },
      price: { type: 'number' },
      in_print: { type: 'boolean' },
      tags: { type: 'array' },
      metadata: { type: 'object' },
    },
    required: ['title'],
  },
};
