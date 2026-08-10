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
  // `groups.role` holds the group-conferred role; memberships no longer carry one.
  db.run('CREATE TABLE groups (id TEXT PRIMARY KEY, name TEXT, role TEXT)');
  db.run('CREATE TABLE group_memberships (id TEXT PRIMARY KEY, group_id TEXT, user TEXT)');
  db.run(
    `CREATE TABLE access_grants (
       id TEXT PRIMARY KEY, subject_type TEXT, subject_id TEXT,
       target_scope TEXT, target_app TEXT, resource_type TEXT, resource_id TEXT,
       filter TEXT, capability TEXT, effect TEXT, is_default INTEGER
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

  test('hasBaseline: a lone role marks the system initialized', () => {
    expect(store.hasBaseline()).toBe(false); // fresh: no grants, no roles
    db.run("INSERT INTO roles (id, name, grants) VALUES ('member', 'Member', '[]')");
    store.clear();
    expect(store.hasBaseline()).toBe(true);
  });

  test('hasBaseline: a lone access-grant (no roles) also counts', () => {
    expect(store.hasBaseline()).toBe(false);
    db.run(
      `INSERT INTO access_grants (id, subject_type, target_scope, capability, effect)
         VALUES ('open', 'everyone', 'all', 'write', 'allow')`,
    );
    store.clear();
    expect(store.hasBaseline()).toBe(true);
  });

  test('assembles group membership into the principal set', () => {
    db.run("INSERT INTO groups (id, name) VALUES ('parents', 'Parents')");
    db.run("INSERT INTO group_memberships (id, group_id, user) VALUES ('m1', 'parents', 'alice')");
    const { principals } = store.gatherFor('alice');
    expect(principals.groupIds).toEqual(new Set(['parents']));
  });

  test('normalizes a users/{id} membership reference to the bare id', () => {
    db.run(
      "INSERT INTO group_memberships (id, group_id, user) VALUES ('m1', 'parents', 'users/alice')",
    );
    expect(store.gatherFor('alice').principals.groupIds).toEqual(new Set(['parents']));
  });

  test('expands a group-conferred role into caller-addressed grants and resolves', () => {
    db.run(
      `INSERT INTO roles (id, name, grants) VALUES
         ('member', 'Member', '[{"target_scope":"all","capability":"write"}]')`,
    );
    // The group confers `member`; the member inherits it just by belonging.
    db.run("INSERT INTO groups (id, name, role) VALUES ('g', 'G', 'member')");
    db.run("INSERT INTO group_memberships (id, group_id, user) VALUES ('m1', 'g', 'alice')");
    const { principals, grants } = store.gatherFor('alice');
    // Member confers write on * → write allowed, manage not.
    expect(resolve(regular, req('write'), principals, grants).allow).toBe(true);
    expect(resolve(regular, req('manage'), principals, grants).allow).toBe(false);
  });

  test('normalizes a groups/{id} conferred-role reference', () => {
    db.run(
      `INSERT INTO roles (id, name, grants) VALUES
         ('member', 'Member', '[{"target_scope":"all","capability":"write"}]')`,
    );
    // Reference stored with a collection prefix still resolves.
    db.run("INSERT INTO groups (id, name, role) VALUES ('g', 'G', 'roles/member')");
    db.run("INSERT INTO group_memberships (id, group_id, user) VALUES ('m1', 'g', 'alice')");
    const { principals, grants } = store.gatherFor('alice');
    expect(resolve(regular, req('write'), principals, grants).allow).toBe(true);
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
    db.run("INSERT INTO groups (id, name, role) VALUES ('g', 'G', 'member')");
    db.run("INSERT INTO group_memberships (id, group_id, user) VALUES ('m1', 'g', 'alice')");
    db.run(
      `INSERT INTO access_grants (id, subject_type, subject_id, target_scope, target_app, capability, effect)
         VALUES ('d1', 'user', 'alice', 'app', 'recipes', 'read', 'deny')`,
    );
    const { principals, grants } = store.gatherFor('alice');
    expect(resolve(regular, req('read'), principals, grants).allow).toBe(false);
  });

  test('a role-carried deny blocks its members (deny grant inside a role)', () => {
    // "Kids" role: allow write on everything, but deny the recipes app.
    db.run(
      `INSERT INTO roles (id, name, grants) VALUES
         ('kids', 'Kids', '[{"target_scope":"all","capability":"write"},{"target_scope":"app","target_app":"recipes","capability":"manage","effect":"deny"}]')`,
    );
    db.run("INSERT INTO groups (id, name, role) VALUES ('g', 'G', 'kids')");
    db.run("INSERT INTO group_memberships (id, group_id, user) VALUES ('m1', 'g', 'alice')");
    const { principals, grants } = store.gatherFor('alice');
    // The allow covers other apps…
    expect(resolve(regular, req('write', { resourceType: 'todo', appId: 'todos' }), principals, grants).allow).toBe(true);
    // …but the role's own deny blocks the recipes app (deny always wins).
    expect(resolve(regular, req('read'), principals, grants).allow).toBe(false);
    expect(resolve(regular, req('write'), principals, grants).allow).toBe(false);
  });

  // ─────────── default-grant fallback suppression (§8.x) ───────────

  /** The seeded open-household default: everyone → write → * , is_default = 1. */
  function seedDefaultGrant(): void {
    db.run(
      `INSERT INTO access_grants (id, subject_type, target_scope, capability, effect, is_default)
         VALUES ('open', 'everyone', 'all', 'write', 'allow', 1)`,
    );
  }

  /** A group conferring a role that grants only write on the pictionary app. */
  function seedPictionaryRoleGroup(user: string): void {
    db.run(
      `INSERT INTO roles (id, name, grants) VALUES
         ('pict', 'Pictionary', '[{"target_scope":"app","target_app":"pictionary","capability":"write"}]')`,
    );
    db.run("INSERT INTO groups (id, name, role) VALUES ('g', 'G', 'pict')");
    db.run(`INSERT INTO group_memberships (id, group_id, user) VALUES ('m1', 'g', '${user}')`);
  }

  test('the default grant applies to a user with no conferred role', () => {
    seedDefaultGrant();
    const { principals, grants } = store.gatherFor('alice');
    // No group → default applies → full read/write everywhere.
    expect(resolve(regular, req('write'), principals, grants).allow).toBe(true);
    expect(resolve(regular, req('read', { resourceType: 'todo', appId: 'todos' }), principals, grants).allow).toBe(true);
  });

  test('a conferred role suppresses the default — the role defines access outright', () => {
    seedDefaultGrant();
    seedPictionaryRoleGroup('alice');
    const { principals, grants } = store.gatherFor('alice');
    // The role grants only the pictionary app…
    expect(
      resolve(regular, req('write', { resourceType: 'pictionary-game', appId: 'pictionary' }), principals, grants).allow,
    ).toBe(true);
    // …and the default no longer unions back to cover everything else.
    expect(resolve(regular, req('write'), principals, grants).allow).toBe(false);
    expect(resolve(regular, req('read', { resourceType: 'todo', appId: 'todos' }), principals, grants).allow).toBe(false);
  });

  test('only the default grant is suppressed — other everyone grants survive a role', () => {
    seedDefaultGrant();
    db.run(
      `INSERT INTO access_grants (id, subject_type, target_scope, capability, effect, is_default)
         VALUES ('share', 'everyone', 'all', 'read', 'allow', 0)`,
    );
    seedPictionaryRoleGroup('alice');
    const { principals, grants } = store.gatherFor('alice');
    // The non-default everyone→read grant is untouched: reads stay open…
    expect(resolve(regular, req('read'), principals, grants).allow).toBe(true);
    // …but the write default is gone, so writes are limited to the role's app.
    expect(resolve(regular, req('write'), principals, grants).allow).toBe(false);
  });

  test('a direct (non-role) grant does not suppress the default', () => {
    seedDefaultGrant();
    // Alice gets one shared record but belongs to no role-bearing group.
    db.run(
      `INSERT INTO access_grants (id, subject_type, subject_id, target_scope, resource_type, resource_id, capability, effect, is_default)
         VALUES ('rec', 'user', 'alice', 'record', 'recipe', 'r1', 'read', 'allow', 0)`,
    );
    const { principals, grants } = store.gatherFor('alice');
    // No conferred role → default still applies → full access retained.
    expect(resolve(regular, req('write'), principals, grants).allow).toBe(true);
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
