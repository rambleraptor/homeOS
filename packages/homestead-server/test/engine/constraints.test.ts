/**
 * Standard JSON-schema assertion keywords (minimum/maximum, minLength/maxLength,
 * pattern, minItems/maxItems, uniqueItems) enforced by the engine on every write
 * path. Unlike `enum`, these survive as first-class OpenAPI values, so they are
 * both self-documenting and enforced — see `engine/validate.ts#validateConstraints`.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { call, defineResource, makeEngine, type TestEngine } from './helpers';

let t: TestEngine;

async function seedSchema(): Promise<void> {
  await defineResource(t, {
    singular: 'widget',
    plural: 'widgets',
    user_settable_create: true,
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', minimum: 0, maximum: 100 },
        qty: { type: 'integer', exclusiveMinimum: 0, multipleOf: 5 },
        code: { type: 'string', minLength: 2, maxLength: 4, pattern: '^[A-Z]+$' },
        tags: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          uniqueItems: true,
          items: { type: 'string', maxLength: 5 },
        },
      },
    },
  });
}

async function create(body: Record<string, unknown>): Promise<Response> {
  return call(t.engine, 'POST', '/widgets', { token: t.adminToken, body });
}

beforeEach(async () => {
  t = await makeEngine();
  await seedSchema();
});

describe('numeric constraints', () => {
  test('accepts a value within [minimum, maximum]', async () => {
    expect((await create({ amount: 50 })).status).toBe(201);
  });

  test('rejects below minimum', async () => {
    const res = await create({ amount: -1 });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('must be >= 0');
  });

  test('rejects above maximum', async () => {
    const res = await create({ amount: 101 });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('must be <= 100');
  });

  test('rejects a non-exclusive lower bound (exclusiveMinimum)', async () => {
    const res = await create({ qty: 0 });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('must be > 0');
  });

  test('rejects a non-multiple (multipleOf)', async () => {
    const res = await create({ qty: 7 });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('multiple of 5');
  });

  test('accepts an exact multiple above the exclusive bound', async () => {
    expect((await create({ qty: 15 })).status).toBe(201);
  });
});

describe('string constraints', () => {
  test('accepts a matching value within length bounds', async () => {
    expect((await create({ code: 'ABC' })).status).toBe(201);
  });

  test('rejects below minLength', async () => {
    const res = await create({ code: 'A' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('at least 2 characters');
  });

  test('rejects above maxLength', async () => {
    const res = await create({ code: 'ABCDE' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('at most 4 characters');
  });

  test('rejects a pattern mismatch', async () => {
    const res = await create({ code: 'ab' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('must match pattern');
  });
});

describe('array constraints', () => {
  test('accepts an array within cardinality bounds', async () => {
    expect((await create({ tags: ['a', 'b'] })).status).toBe(201);
  });

  test('rejects an empty array below minItems', async () => {
    const res = await create({ tags: [] });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('at least 1 items');
  });

  test('rejects more than maxItems', async () => {
    const res = await create({ tags: ['a', 'b', 'c', 'd'] });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('at most 3 items');
  });

  test('rejects duplicate items (uniqueItems)', async () => {
    const res = await create({ tags: ['a', 'a'] });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('must be unique');
  });

  test('enforces per-item constraints one level deep', async () => {
    const res = await create({ tags: ['toolong'] });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('at most 5 characters');
  });
});

describe('write-path coverage', () => {
  test('null clears a field without tripping a constraint', async () => {
    const created = await (await create({ amount: 10 })).json();
    const res = await call(t.engine, 'PATCH', `/widgets/${created.id}`, {
      token: t.adminToken,
      contentType: 'application/merge-patch+json',
      body: { amount: null },
    });
    expect(res.status).toBe(200);
  });

  test('enforces constraints on update (PATCH)', async () => {
    const created = await (await create({ amount: 10 })).json();
    const res = await call(t.engine, 'PATCH', `/widgets/${created.id}`, {
      token: t.adminToken,
      contentType: 'application/merge-patch+json',
      body: { amount: 999 },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('must be <= 100');
  });

  test('enforces constraints on full-replace (PUT)', async () => {
    const res = await call(t.engine, 'PUT', '/widgets/w1', {
      token: t.adminToken,
      body: { code: 'toolong' },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('at most 4 characters');
  });
});
