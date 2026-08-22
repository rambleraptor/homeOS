/**
 * A personal access token records when it was last used. The
 * `personal-access-token` record carries a `last_used_at` field that the
 * settings page renders ("Last used …" vs "Never used"), and nothing but an
 * authenticated request ever writes it — so the engine stamps it at the one
 * place every PAT-bearing request passes through.
 *
 * The stamp is throttled: a token making many calls rewrites the row at most
 * once a minute, and using a token never counts as an edit (`update_time` is
 * left alone).
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { toWireSchema } from '@rambleraptor/homestead-core/resources/translate';
import {
  BUILTIN_RESOURCE_DEFS,
  PERSONAL_ACCESS_TOKENS,
} from '@rambleraptor/homestead-core/resources/builtins';
import { insertToken } from '../../src/engine/users';
import { generatePatSecret } from '../../src/engine/pat';
import { call, defineResource, makeEngine, seedOpenHousehold, type TestEngine } from './helpers';

interface PatRow {
  last_used_at: string | null;
  update_time: string;
}

describe('PAT last_used_at', () => {
  let t: TestEngine;
  let patId: string;
  let secret: string;

  const patRow = (): PatRow =>
    t.engine.db
      .query('SELECT last_used_at, update_time FROM personal_access_tokens WHERE id = ?')
      .get(patId) as PatRow;

  beforeEach(async () => {
    process.env.PERMISSION_CACHE_TTL_MS = '0';
    t = await makeEngine();
    await seedOpenHousehold(t);

    const def = BUILTIN_RESOURCE_DEFS.find((d) => d.plural === PERSONAL_ACCESS_TOKENS)!;
    await defineResource(
      t,
      {
        singular: def.singular,
        plural: def.plural,
        parents: def.parents ?? [],
        user_settable_create: true,
        schema: toWireSchema(def.fields, def.singular),
      },
      def.singular,
    );

    // The readable metadata record, plus the bearer secret linked to it — the
    // same pair `POST /api/tokens` mints in production.
    const created = await call(
      t.engine,
      'POST',
      `/users/${t.admin.id}/${PERSONAL_ACCESS_TOKENS}`,
      { token: t.adminToken, body: { name: 'Home Assistant' } },
    );
    expect(created.status).toBe(201);
    patId = ((await created.json()) as { id: string }).id;

    secret = generatePatSecret();
    insertToken(t.engine.db, secret, t.admin.id, null, patId);
  });

  test('a fresh token reads as never used', () => {
    expect(patRow().last_used_at).toBeNull();
  });

  test('an authenticated request stamps last_used_at', async () => {
    const before = patRow().update_time;

    const res = await call(t.engine, 'GET', '/users/me', { token: secret });
    expect(res.status).toBe(200);

    const row = patRow();
    expect(row.last_used_at).not.toBeNull();
    // Using a token is not an edit of the record.
    expect(row.update_time).toBe(before);

    // …and the settings page reads it back off the record.
    const read = await call(
      t.engine,
      'GET',
      `/users/${t.admin.id}/${PERSONAL_ACCESS_TOKENS}/${patId}`,
      { token: t.adminToken },
    );
    expect(read.status).toBe(200);
    expect((await read.json()) as { last_used_at?: string }).toMatchObject({
      last_used_at: row.last_used_at,
    });
  });

  test('a session token stamps nothing', async () => {
    const res = await call(t.engine, 'GET', '/users/me', { token: t.adminToken });
    expect(res.status).toBe(200);
    expect(patRow().last_used_at).toBeNull();
  });

  test('repeat calls inside the resolution window do not rewrite the row', async () => {
    await call(t.engine, 'GET', '/users/me', { token: secret });
    const first = patRow().last_used_at;

    await call(t.engine, 'GET', '/users/me', { token: secret });
    expect(patRow().last_used_at).toBe(first);
  });

  test('a stale stamp is refreshed', async () => {
    const stale = '2020-01-01T00:00:00Z';
    t.engine.db
      .query('UPDATE personal_access_tokens SET last_used_at = ? WHERE id = ?')
      .run(stale, patId);

    await call(t.engine, 'GET', '/users/me', { token: secret });
    expect(patRow().last_used_at).not.toBe(stale);
  });
});
