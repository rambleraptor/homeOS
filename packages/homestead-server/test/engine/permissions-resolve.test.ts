/**
 * Permissions Phase 1: the pure resolver truth table. Covers the §4 precedence
 * rules (superuser break-glass, deny-always-wins, scope hierarchy, owner,
 * capability ladder, default deny) and the §4.1 LIST visibility modes. No DB,
 * no request plumbing — just the decision functions.
 */

import { describe, expect, test } from 'vitest';
import {
  computeVisibility,
  resolve,
  type AccessRequest,
  type Grant,
  type Principals,
  type Verb,
} from '../../src/engine/permissions';

const alice: Principals = { userId: 'alice', groupIds: new Set(['parents']) };
const regular = { isSuperuser: false };
const superuser = { isSuperuser: true };

function req(verb: Verb, over: Partial<AccessRequest> = {}): AccessRequest {
  return { verb, resourceType: 'recipe', appId: 'recipes', ...over };
}

function grant(over: Partial<Grant> & Pick<Grant, 'target'>): Grant {
  return {
    subject: { type: 'everyone' },
    capability: 'read',
    effect: 'allow',
    ...over,
  };
}

describe('resolve() — precedence', () => {
  test('superuser is allowed unconditionally, even against a matching deny', () => {
    const denyAll: Grant = grant({
      subject: { type: 'everyone' },
      capability: 'manage',
      effect: 'deny',
      target: { scope: 'all' },
    });
    expect(resolve(superuser, req('manage'), alice, [denyAll]).reason).toBe('superuser');
    expect(resolve(superuser, req('manage'), alice, [denyAll]).allow).toBe(true);
  });

  test('default deny when nothing matches', () => {
    const d = resolve(regular, req('read'), alice, []);
    expect(d).toEqual({ allow: false, reason: 'no-grant' });
  });

  test('an everyone allow at * grants read/write per the ladder', () => {
    const g = grant({ capability: 'write', target: { scope: 'all' } });
    expect(resolve(regular, req('read'), alice, [g]).allow).toBe(true);
    expect(resolve(regular, req('write'), alice, [g]).allow).toBe(true);
    // write does not imply manage
    expect(resolve(regular, req('manage'), alice, [g]).allow).toBe(false);
  });

  test('deny always wins over an allow, at any scope', () => {
    const allowRecord = grant({
      capability: 'write',
      target: { scope: 'record', resource_type: 'recipe', resource_id: 'r1' },
    });
    const denyApp = grant({
      capability: 'read',
      effect: 'deny',
      target: { scope: 'app', app: 'recipes' },
    });
    // Broad app-scope deny read beats the narrow record-scope allow write.
    const d = resolve(regular, req('read', { recordId: 'r1' }), alice, [allowRecord, denyApp]);
    expect(d).toEqual({ allow: false, reason: 'denied' });
  });

  test('a deny below the required capability does not block', () => {
    // deny read, but the request is... read — that blocks. Use deny read vs write?
    // A deny at read blocks read AND write (deny rank >= required for both).
    const denyRead = grant({ capability: 'read', effect: 'deny', target: { scope: 'all' } });
    expect(resolve(regular, req('read'), alice, [denyRead]).allow).toBe(false);
    expect(resolve(regular, req('write'), alice, [denyRead]).allow).toBe(false);
  });

  test('a manage-scoped deny blocks only manage when required is manage', () => {
    const allowWrite = grant({ capability: 'write', target: { scope: 'all' } });
    const denyManage = grant({ capability: 'manage', effect: 'deny', target: { scope: 'all' } });
    // write is allowed (denyManage rank 3 >= write rank 2 → actually blocks!).
    // deny-always-wins: a manage deny (rank 3) blocks write (rank 2) too.
    expect(resolve(regular, req('write'), alice, [allowWrite, denyManage]).allow).toBe(false);
  });

  test('owner ⇒ manage as an allow, but a deny still beats the owner', () => {
    const ownReq = req('manage', { recordId: 'r1', recordOwner: 'alice' });
    expect(resolve(regular, ownReq, alice, []).allow).toBe(true); // owner gets manage

    const denyOwner = grant({
      capability: 'manage',
      effect: 'deny',
      target: { scope: 'record', resource_type: 'recipe', resource_id: 'r1' },
    });
    expect(resolve(regular, ownReq, alice, [denyOwner]).allow).toBe(false);
  });

  test('group subject matches via the caller principals', () => {
    const g = grant({ subject: { type: 'group', id: 'parents' }, capability: 'write', target: { scope: 'app', app: 'recipes' } });
    expect(resolve(regular, req('write'), alice, [g]).allow).toBe(true);
    // A group the caller isn't in doesn't match.
    const other = grant({ subject: { type: 'group', id: 'kids' }, capability: 'write', target: { scope: 'all' } });
    expect(resolve(regular, req('write'), alice, [other]).allow).toBe(false);
  });

  test('user subject matches only the named user', () => {
    const g = grant({ subject: { type: 'user', id: 'bob' }, capability: 'read', target: { scope: 'all' } });
    expect(resolve(regular, req('read'), alice, [g]).allow).toBe(false);
  });

  test('app-scope grant matches only its app', () => {
    const g = grant({ capability: 'write', target: { scope: 'app', app: 'todos' } });
    expect(resolve(regular, req('write', { appId: 'recipes' }), alice, [g]).allow).toBe(false);
    expect(resolve(regular, req('write', { appId: 'todos' }), alice, [g]).allow).toBe(true);
  });

  test('filtered collection grant does not match without a filter evaluator (Phase 1)', () => {
    const g = grant({ capability: 'read', target: { scope: 'collection', resource_type: 'recipe', filter: 'x == 1' } });
    expect(resolve(regular, req('read'), alice, [g]).allow).toBe(false);
    // With an evaluator (Phase 4 shape), it can match.
    expect(resolve(regular, req('read'), alice, [g], () => true).allow).toBe(true);
  });
});

describe('computeVisibility() — LIST modes', () => {
  const listReq = { resourceType: 'recipe', appId: 'recipes' as string | null };

  test('broad allow with no denies → all', () => {
    const g = grant({ capability: 'write', target: { scope: 'all' } });
    expect(computeVisibility(listReq, alice, [g])).toEqual({ mode: 'all' });
  });

  test('broad deny read → none, even with record allows', () => {
    const allowRec = grant({ capability: 'read', target: { scope: 'record', resource_type: 'recipe', resource_id: 'r1' } });
    const denyAll = grant({ capability: 'read', effect: 'deny', target: { scope: 'all' } });
    expect(computeVisibility(listReq, alice, [allowRec, denyAll])).toEqual({ mode: 'none' });
  });

  test('broad allow minus record/filter denies → all-except', () => {
    const allowAll = grant({ capability: 'write', target: { scope: 'app', app: 'recipes' } });
    const denyRec = grant({ capability: 'read', effect: 'deny', target: { scope: 'record', resource_type: 'recipe', resource_id: 'secret' } });
    expect(computeVisibility(listReq, alice, [allowAll, denyRec])).toEqual({
      mode: 'all-except',
      denyRecordIds: ['secret'],
      denyFilters: [],
    });
  });

  test('no broad allow → only (owner ∪ record grants ∪ filters), minus denies', () => {
    const allowRec = grant({ capability: 'read', target: { scope: 'record', resource_type: 'recipe', resource_id: 'r1' } });
    const allowFilter = grant({ capability: 'read', target: { scope: 'collection', resource_type: 'recipe', filter: 'created_by == subject.id' } });
    const denyRec = grant({ capability: 'read', effect: 'deny', target: { scope: 'record', resource_type: 'recipe', resource_id: 'r2' } });
    expect(computeVisibility(listReq, alice, [allowRec, allowFilter, denyRec])).toEqual({
      mode: 'only',
      ownerAllowed: true,
      allowRecordIds: ['r1'],
      allowFilters: ['created_by == subject.id'],
      denyRecordIds: ['r2'],
      denyFilters: [],
    });
  });

  test('no grants at all → only, owner-visible but nothing else', () => {
    expect(computeVisibility(listReq, alice, [])).toEqual({
      mode: 'only',
      ownerAllowed: true,
      allowRecordIds: [],
      allowFilters: [],
      denyRecordIds: [],
      denyFilters: [],
    });
  });

  test('grants for other principals are ignored', () => {
    const forBob = grant({ subject: { type: 'user', id: 'bob' }, capability: 'write', target: { scope: 'all' } });
    expect(computeVisibility(listReq, alice, [forBob])).toEqual({
      mode: 'only',
      ownerAllowed: true,
      allowRecordIds: [],
      allowFilters: [],
      denyRecordIds: [],
      denyFilters: [],
    });
  });
});
