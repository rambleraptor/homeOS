/**
 * Create-only fields (`x-aepbase-immutable`).
 *
 * The engine refuses an update or full-replace that carries one, rather than
 * silently dropping it the way `readOnly` is dropped. The distinction is the
 * point of the feature: the chat tools derive `update_<resource>` parameters
 * from a resource's fields, so a model *will* offer the field, and a silent
 * strip would hand it a no-op it reads as success.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { call, defineResource, makeEngine, type TestEngine } from './helpers';

const NOTE_DEF = {
  singular: 'note',
  plural: 'notes',
  user_settable_create: true,
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      visibility: {
        type: 'string',
        default: 'household',
        'x-aepbase-immutable': true,
      },
    },
    required: ['title'],
  },
};

let t: TestEngine;

beforeEach(async () => {
  t = await makeEngine();
  const res = await defineResource(t, NOTE_DEF);
  expect(res.status).toBe(200);
});

describe('create', () => {
  test('accepts an immutable field — create is the write that may set it', async () => {
    const res = await call(t.engine, 'POST', '/notes', {
      token: t.adminToken,
      body: { title: 'A', visibility: 'private' },
    });
    expect(res.status).toBe(201);
    expect((await res.json()).visibility).toBe('private');
  });

  test('applies the declared default when omitted', async () => {
    const res = await call(t.engine, 'POST', '/notes', {
      token: t.adminToken,
      body: { title: 'A' },
    });
    expect((await res.json()).visibility).toBe('household');
  });
});

describe('update', () => {
  let id: string;

  beforeEach(async () => {
    const res = await call(t.engine, 'POST', '/notes', {
      token: t.adminToken,
      body: { title: 'A', visibility: 'private' },
    });
    id = (await res.json()).id;
  });

  test('rejects a PATCH carrying the immutable field', async () => {
    const res = await call(t.engine, 'PATCH', `/notes/${id}`, {
      token: t.adminToken,
      body: { visibility: 'household' },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(
      /cannot modify immutable field: visibility/,
    );
  });

  test('leaves the stored value untouched after a rejected PATCH', async () => {
    await call(t.engine, 'PATCH', `/notes/${id}`, {
      token: t.adminToken,
      body: { title: 'B', visibility: 'household' },
    });
    const res = await call(t.engine, 'GET', `/notes/${id}`, { token: t.adminToken });
    const body = await res.json();
    expect(body.visibility).toBe('private');
    // The whole request is refused, so the title change doesn't land either.
    expect(body.title).toBe('A');
  });

  test('allows a PATCH that leaves the field alone', async () => {
    const res = await call(t.engine, 'PATCH', `/notes/${id}`, {
      token: t.adminToken,
      body: { title: 'B' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('B');
    expect(body.visibility).toBe('private');
  });

  test('rejects re-sending the field even at its current value', async () => {
    // Idempotent in effect, but still a write the caller believes changed
    // something. Refusing keeps the rule one sentence long.
    const res = await call(t.engine, 'PATCH', `/notes/${id}`, {
      token: t.adminToken,
      body: { visibility: 'private' },
    });
    expect(res.status).toBe(400);
  });
});

describe('apply (PUT)', () => {
  test('rejects a full replace carrying the field onto an existing record', async () => {
    const created = await call(t.engine, 'POST', '/notes', {
      token: t.adminToken,
      body: { title: 'A', visibility: 'private' },
    });
    const { id } = await created.json();

    const res = await call(t.engine, 'PUT', `/notes/${id}`, {
      token: t.adminToken,
      body: { title: 'B', visibility: 'household' },
    });
    expect(res.status).toBe(400);
  });

  test('accepts it when the apply creates the record', async () => {
    // PUT to a path with no record is a create (201), and create may set it.
    const res = await call(t.engine, 'PUT', '/notes/brand-new', {
      token: t.adminToken,
      body: { title: 'A', visibility: 'private' },
    });
    expect(res.status).toBe(201);
    expect((await res.json()).visibility).toBe('private');
  });
});
