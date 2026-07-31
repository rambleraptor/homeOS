/**
 * PermissionStore: loads grants/groups/memberships/roles and assembles the
 * caller's principals + applicable grants (including role-bundle expansion),
 * then feeds the pure resolver. Tables are built directly here to match the
 * layout the resource definitions produce.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { openDb } from '../../src/engine/db';
import type { Database } from '../../src/engine/sqlite';
import { PermissionStore } from '../../src/engine/permission-store';
import { resolve, type AccessRequest, type Verb } from '../../src/engine/permissions';

function createTables(db: Database): void {
  db.run('CREATE TABLE roles (id TEXT PRIMARY KEY, name TEXT, grants TEXT)');
  db.run('CREATE TABLE groups (id TEXT PRIMARY KEY, name TEXT)');
  db.run(
    'CREATE TABLE group_memberships (id TEXT PRIMARY KEY, group_id TEXT, user TEXT, role TEXT)',
  );
  db.run(
    `CREATE TABLE access_grants (
       id TEXT PRIMARY KEY, subject_type TEXT, subject_id TEXT,
       target_scope TEXT, target_app TEXT, resource_type TEXT, resource_id TEXT,
       filter TEXT, capability TEXT, effect TEXT
     )`,
  );
}

function req(verb: Verb, over: Partial<AccessRequest> = {}): AccessRequest {
  return { verb, resourceType: 'recipe', appId: 'recipes', ...over };
}

const regular = { isSuperuser: false };

describe('PermissionStore.gatherFor', () => {
  let db: Database;
  let store: PermissionStore;

  beforeEach(() => {
    db = openDb(':memory:');
    createTables(db);
    store = new PermissionStore(db);
  });

  test('missing tables → empty (fresh db before sync)', () => {
    const fresh = new PermissionStore(openDb(':memory:'));
    const { principals, grants } = fresh.gatherFor('alice');
    expect(principals).toEqual({ userId: 'alice', groupIds: new Set() });
    expect(grants).toEqual([]);
  });

  test('assembles group membership into the principal set', () => {
    db.run("INSERT INTO groups (id, name) VALUES ('parents', 'Parents')");
    db.run(
      "INSERT INTO group_memberships (id, group_id, user, role) VALUES ('m1', 'parents', 'alice', NULL)",
    );
    const { principals } = store.gatherFor('alice');
    expect(principals.groupIds).toEqual(new Set(['parents']));
  });

  test('normalizes a users/{id} membership reference to the bare id', () => {
    db.run(
      "INSERT INTO group_memberships (id, group_id, user, role) VALUES ('m1', 'parents', 'users/alice', NULL)",
    );
    expect(store.gatherFor('alice').principals.groupIds).toEqual(new Set(['parents']));
  });

  test('expands a role bundle into caller-addressed grants and resolves', () => {
    db.run(
      `INSERT INTO roles (id, name, grants) VALUES
         ('member', 'Member', '[{"target_scope":"all","capability":"write"}]')`,
    );
    db.run(
      "INSERT INTO group_memberships (id, group_id, user, role) VALUES ('m1', 'g', 'alice', 'member')",
    );
    const { principals, grants } = store.gatherFor('alice');
    // Member confers write on * → write allowed, manage not.
    expect(resolve(regular, req('write'), principals, grants).allow).toBe(true);
    expect(resolve(regular, req('manage'), principals, grants).allow).toBe(false);
  });

  test('direct everyone/user/group grants flow through and resolve', () => {
    db.run(
      `INSERT INTO access_grants (id, subject_type, subject_id, target_scope, capability, effect)
         VALUES ('g1', 'everyone', NULL, 'all', 'read', 'allow')`,
    );
    db.run(
      `INSERT INTO access_grants (id, subject_type, subject_id, target_scope, target_app, capability, effect)
         VALUES ('g2', 'group', 'parents', 'app', 'recipes', 'write', 'allow')`,
    );
    db.run("INSERT INTO group_memberships (id, group_id, user) VALUES ('m1', 'parents', 'alice')");

    const { principals, grants } = store.gatherFor('alice');
    // everyone → read; group parents → write on recipes app.
    expect(resolve(regular, req('read'), principals, grants).allow).toBe(true);
    expect(resolve(regular, req('write'), principals, grants).allow).toBe(true);

    // A different user gets read (everyone) but not the group's write.
    const bob = store.gatherFor('bob');
    expect(resolve(regular, req('read'), bob.principals, bob.grants).allow).toBe(true);
    expect(resolve(regular, req('write'), bob.principals, bob.grants).allow).toBe(false);
  });

  test('a deny grant beats a role allow (deny always wins)', () => {
    db.run(
      `INSERT INTO roles (id, name, grants) VALUES
         ('member', 'Member', '[{"target_scope":"all","capability":"write"}]')`,
    );
    db.run(
      "INSERT INTO group_memberships (id, group_id, user, role) VALUES ('m1', 'g', 'alice', 'member')",
    );
    db.run(
      `INSERT INTO access_grants (id, subject_type, subject_id, target_scope, target_app, capability, effect)
         VALUES ('d1', 'user', 'alice', 'app', 'recipes', 'read', 'deny')`,
    );
    const { principals, grants } = store.gatherFor('alice');
    expect(resolve(regular, req('read'), principals, grants).allow).toBe(false);
  });

  test('effect defaults to allow when the column is null', () => {
    db.run(
      `INSERT INTO access_grants (id, subject_type, target_scope, capability, effect)
         VALUES ('g1', 'everyone', 'all', 'read', NULL)`,
    );
    const { grants } = store.gatherFor('alice');
    expect(grants[0]?.effect).toBe('allow');
  });

  test('clear() forces a reload so writes are seen', () => {
    expect(store.gatherFor('alice').grants).toHaveLength(0);
    db.run(
      `INSERT INTO access_grants (id, subject_type, target_scope, capability, effect)
         VALUES ('g1', 'everyone', 'all', 'read', 'allow')`,
    );
    // Still cached (TTL) → not yet visible.
    expect(store.gatherFor('alice').grants).toHaveLength(0);
    store.clear();
    expect(store.gatherFor('alice').grants).toHaveLength(1);
  });
});
