/**
 * Permissions Phase 0: the engine-managed `_owner` column. New records are
 * stamped with the creating caller's id; pre-existing rows are backfilled from
 * `created_by`. Nothing reads `_owner` yet, so behavior is otherwise unchanged.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import {
  OWNER_COLUMN,
  backfillOwnerFromCreatedBy,
  createResourceTable,
  ensureOwnerColumn,
} from '../../src/engine/db';
import {
  BOOK_DEF,
  call,
  defineResource,
  makeEngine,
  seedOpenHousehold,
  seedUser,
  type TestEngine,
} from './helpers';

const DOC_DEF = {
  singular: 'doc',
  plural: 'docs',
  user_settable_create: true,
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      created_by: { type: 'string' },
    },
  },
};

function ownerOf(t: TestEngine, table: string, id: string): unknown {
  const row = t.engine.db
    .query(`SELECT ${OWNER_COLUMN} AS owner FROM ${table} WHERE id = ?`)
    .get(id) as { owner: unknown } | null;
  return row?.owner ?? null;
}

describe('_owner column (permissions Phase 0)', () => {
  let t: TestEngine;

  beforeEach(async () => {
    t = await makeEngine();
    await defineResource(t, BOOK_DEF);
    await defineResource(t, DOC_DEF);
    // These tests exercise owner-stamping as a regular user; seed a normal
    // open-household baseline so the engine's fail-closed default doesn't block
    // the create under test.
    await seedOpenHousehold(t);
  });

  test('create stamps _owner with the creating user id', async () => {
    const u = await seedUser(t.engine, { email: 'u@example.com' });
    const res = await call(t.engine, 'POST', '/books?id=b1', {
      token: u.token,
      body: { title: 'Mine' },
    });
    expect(res.status).toBe(201);
    expect(ownerOf(t, 'books', 'b1')).toBe(u.user.id);
  });

  test('a superuser create stamps the superuser id', async () => {
    const res = await call(t.engine, 'POST', '/books?id=b2', {
      token: t.adminToken,
      body: { title: 'Admin book' },
    });
    expect(res.status).toBe(201);
    expect(ownerOf(t, 'books', 'b2')).toBe(t.admin.id);
  });

  test('_owner is invisible in the resource representation', async () => {
    const u = await seedUser(t.engine, { email: 'u@example.com' });
    const res = await call(t.engine, 'POST', '/books?id=b3', {
      token: u.token,
      body: { title: 'Hidden owner' },
    });
    const body = await res.json();
    expect(body._owner).toBeUndefined();
    expect(body.title).toBe('Hidden owner');
  });

  test('backfill fills _owner from a users/{id} created_by path', async () => {
    // Simulate a legacy row: created before owner-stamping existed.
    await call(t.engine, 'POST', '/docs?id=d1', { token: t.adminToken, body: { title: 'x' } });
    t.engine.db.run(
      `UPDATE docs SET ${OWNER_COLUMN} = NULL, created_by = 'users/legacy123' WHERE id = 'd1'`,
    );
    expect(ownerOf(t, 'docs', 'd1')).toBeNull();

    backfillOwnerFromCreatedBy(t.engine.db, 'docs', true);
    expect(ownerOf(t, 'docs', 'd1')).toBe('legacy123');
  });

  test('boot recreates _owner column + index on a legacy pre-permissions table', () => {
    const db = t.engine.db;
    const has = (pragma: string, name: string, table: string): boolean =>
      (db.query(`PRAGMA ${pragma}(${table})`).all() as { name: string }[]).some(
        (r) => r.name === name,
      );

    // A table created before the permissions phase: no _owner column, no index.
    db.run(`CREATE TABLE legacies (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      create_time TEXT NOT NULL,
      update_time TEXT NOT NULL,
      title TEXT
    )`);
    expect(has('table_info', OWNER_COLUMN, 'legacies')).toBe(false);

    // Boot path: createResourceTable is a no-op here (IF NOT EXISTS on the
    // existing table), so it must NOT index the not-yet-present _owner column.
    expect(() =>
      createResourceTable(db, 'legacies', [], [{ name: 'title', sqlType: 'TEXT' }]),
    ).not.toThrow();

    // ensureOwnerColumn then adds the column and its index.
    ensureOwnerColumn(db, 'legacies');
    expect(has('table_info', OWNER_COLUMN, 'legacies')).toBe(true);
    expect(has('index_list', 'idx_legacies_owner', 'legacies')).toBe(true);
  });

  test('backfill handles a bare-id created_by and leaves stamped rows alone', async () => {
    await call(t.engine, 'POST', '/docs?id=d2', { token: t.adminToken, body: { title: 'y' } });
    t.engine.db.run(
      `UPDATE docs SET ${OWNER_COLUMN} = NULL, created_by = 'bare456' WHERE id = 'd2'`,
    );
    // An already-stamped row must not be overwritten by the backfill.
    await call(t.engine, 'POST', '/docs?id=d3', { token: t.adminToken, body: { title: 'z', created_by: 'users/other' } });

    backfillOwnerFromCreatedBy(t.engine.db, 'docs', true);

    expect(ownerOf(t, 'docs', 'd2')).toBe('bare456'); // no 'users/' prefix → left as-is
    expect(ownerOf(t, 'docs', 'd3')).toBe(t.admin.id); // stamped on create, untouched by backfill
  });
});
