/**
 * Referential integrity on delete: the engine reads `x-aepbase-reference`
 * markers off resource schemas and enforces the declared `onDelete` behavior.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { call, defineResource, makeEngine, type TestEngine } from './helpers';

let t: TestEngine;

/** Define `store` and a `grocery`/`event` that reference it various ways. */
async function seedSchema(onDelete: 'restrict' | 'set-null' | 'cascade' | null): Promise<void> {
  await defineResource(t, {
    singular: 'store',
    plural: 'stores',
    user_settable_create: true,
    schema: { type: 'object', properties: { name: { type: 'string' } } },
  });
  const ref = onDelete ? { resource: 'store', onDelete } : { resource: 'store' };
  await defineResource(t, {
    singular: 'grocery',
    plural: 'groceries',
    user_settable_create: true,
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        store: { type: 'string', 'x-aepbase-reference': ref },
      },
    },
  });
}

async function createStore(name: string): Promise<string> {
  const res = await call(t.engine, 'POST', '/stores', { token: t.adminToken, body: { name } });
  return (await res.json()).id as string;
}

async function createGrocery(name: string, storeId: string): Promise<string> {
  const res = await call(t.engine, 'POST', '/groceries', {
    token: t.adminToken,
    body: { name, store: storeId },
  });
  return (await res.json()).id as string;
}

/** A reference value in the standard `{plural}/{id}` path format. */
function storeRef(id: string): string {
  return `stores/${id}`;
}

beforeEach(async () => {
  t = await makeEngine();
});

describe('onDelete: restrict', () => {
  test('blocks a delete while a record references it, then allows it once clear', async () => {
    await seedSchema('restrict');
    const store = await createStore('Costco');
    const grocery = await createGrocery('Milk', store);

    const blocked = await call(t.engine, 'DELETE', `/stores/${store}`, { token: t.adminToken });
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error.message).toMatch(
      /groceries record\(s\) reference it via "store"/,
    );

    // Still there.
    expect((await call(t.engine, 'GET', `/stores/${store}`, { token: t.adminToken })).status).toBe(200);

    // Remove the referrer, then the store deletes cleanly.
    expect((await call(t.engine, 'DELETE', `/groceries/${grocery}`, { token: t.adminToken })).status).toBe(204);
    expect((await call(t.engine, 'DELETE', `/stores/${store}`, { token: t.adminToken })).status).toBe(204);
  });
});

describe('onDelete: set-null', () => {
  test('clears the pointer on referrers and deletes', async () => {
    await seedSchema('set-null');
    const store = await createStore('Costco');
    const grocery = await createGrocery('Milk', store);

    const del = await call(t.engine, 'DELETE', `/stores/${store}`, { token: t.adminToken });
    expect(del.status).toBe(204);

    const after = await (await call(t.engine, 'GET', `/groceries/${grocery}`, { token: t.adminToken })).json();
    expect(after.store ?? null).toBeNull();
  });
});

describe('onDelete: cascade', () => {
  test('deletes the referring records too', async () => {
    await seedSchema('cascade');
    const store = await createStore('Costco');
    const grocery = await createGrocery('Milk', store);

    const del = await call(t.engine, 'DELETE', `/stores/${store}`, { token: t.adminToken });
    expect(del.status).toBe(204);

    expect((await call(t.engine, 'GET', `/groceries/${grocery}`, { token: t.adminToken })).status).toBe(404);
  });
});

describe('bare reference (no onDelete)', () => {
  test('does not block a delete — enforcement is opt-in', async () => {
    await seedSchema(null);
    const store = await createStore('Costco');
    await createGrocery('Milk', store);

    const del = await call(t.engine, 'DELETE', `/stores/${store}`, { token: t.adminToken });
    expect(del.status).toBe(204);
  });
});

describe('path-format stored values (plural/id)', () => {
  test('restrict matches a stored path value', async () => {
    await seedSchema('restrict');
    const store = await createStore('Costco');
    await createGrocery('Milk', storeRef(store));

    const blocked = await call(t.engine, 'DELETE', `/stores/${store}`, { token: t.adminToken });
    expect(blocked.status).toBe(409);
  });

  test('set-null clears a stored path value', async () => {
    await seedSchema('set-null');
    const store = await createStore('Costco');
    const grocery = await createGrocery('Milk', storeRef(store));

    expect((await call(t.engine, 'DELETE', `/stores/${store}`, { token: t.adminToken })).status).toBe(204);
    const after = await (await call(t.engine, 'GET', `/groceries/${grocery}`, { token: t.adminToken })).json();
    expect(after.store ?? null).toBeNull();
  });

  test('cascade deletes a referrer that stored a path value', async () => {
    await seedSchema('cascade');
    const store = await createStore('Costco');
    const grocery = await createGrocery('Milk', storeRef(store));

    expect((await call(t.engine, 'DELETE', `/stores/${store}`, { token: t.adminToken })).status).toBe(204);
    expect((await call(t.engine, 'GET', `/groceries/${grocery}`, { token: t.adminToken })).status).toBe(404);
  });
});

describe('to-many (array) references', () => {
  test('restrict blocks when an array element points at the target', async () => {
    await defineResource(t, {
      singular: 'person',
      plural: 'people',
      user_settable_create: true,
      schema: { type: 'object', properties: { name: { type: 'string' } } },
    });
    await defineResource(t, {
      singular: 'game',
      plural: 'games',
      user_settable_create: true,
      schema: {
        type: 'object',
        properties: {
          players: {
            type: 'array',
            items: { type: 'string', 'x-aepbase-reference': { resource: 'person', onDelete: 'restrict' } },
          },
        },
      },
    });
    const alice = (await (await call(t.engine, 'POST', '/people', {
      token: t.adminToken,
      body: { name: 'Alice' },
    })).json()).id as string;
    await call(t.engine, 'POST', '/games', { token: t.adminToken, body: { players: [alice] } });

    const blocked = await call(t.engine, 'DELETE', `/people/${alice}`, { token: t.adminToken });
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error.message).toMatch(
      /games record\(s\) reference it via "players"/,
    );
  });

  test('set-null drops a path-format array element pointing at the target', async () => {
    await defineResource(t, {
      singular: 'person',
      plural: 'people',
      user_settable_create: true,
      schema: { type: 'object', properties: { name: { type: 'string' } } },
    });
    await defineResource(t, {
      singular: 'game',
      plural: 'games',
      user_settable_create: true,
      schema: {
        type: 'object',
        properties: {
          players: {
            type: 'array',
            items: { type: 'string', 'x-aepbase-reference': { resource: 'person', onDelete: 'set-null' } },
          },
        },
      },
    });
    const person = async (name: string) =>
      (await (await call(t.engine, 'POST', '/people', { token: t.adminToken, body: { name } })).json())
        .id as string;
    const alice = await person('Alice');
    const bob = await person('Bob');
    const game = (await (await call(t.engine, 'POST', '/games', {
      token: t.adminToken,
      // Stored in the standard path format.
      body: { players: [`people/${alice}`, `people/${bob}`] },
    })).json()).id as string;

    expect((await call(t.engine, 'DELETE', `/people/${alice}`, { token: t.adminToken })).status).toBe(204);
    const after = await (await call(t.engine, 'GET', `/games/${game}`, { token: t.adminToken })).json();
    expect(after.players).toEqual([`people/${bob}`]);
  });
});
