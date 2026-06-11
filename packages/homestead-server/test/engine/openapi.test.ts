/**
 * Validates the generated OpenAPI doc two ways:
 * 1. Structural invariants against a snapshot captured from the real Go
 *    server (test/fixtures/openapi-go-snapshot.json) for the same resource
 *    set.
 * 2. A consumer round-trip through @aep_dev/aep-lib-ts `APIClient.fromOpenAPI`
 *    plus the CLI's patchCreateMethods logic — the actual fidelity bar for
 *    `homestead resources`.
 */

import { beforeAll, describe, expect, test } from 'bun:test';
import { APIClient } from '@aep_dev/aep-lib-ts';
import goSnapshot from '../fixtures/openapi-go-snapshot.json';
import { call, defineResource, makeEngine, type TestEngine } from './helpers';

let t: TestEngine;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let doc: any;

/** Recreate the resource set the Go snapshot was captured with. */
beforeAll(async () => {
  t = await makeEngine();
  await defineResource(t, {
    singular: 'gift-card',
    plural: 'gift-cards',
    user_settable_create: true,
    schema: {
      type: 'object',
      properties: {
        merchant: { type: 'string' },
        card_number: { type: 'string' },
        amount: { type: 'number' },
        archived: { type: 'boolean' },
        front_image: { type: 'binary', 'x-aepbase-file-field': true },
      },
      required: ['merchant', 'card_number', 'amount'],
    },
  });
  await defineResource(t, {
    singular: 'transaction',
    plural: 'transactions',
    parents: ['gift-card'],
    user_settable_create: true,
    schema: {
      type: 'object',
      properties: { notes: { type: 'string' }, new_amount: { type: 'number' } },
      required: ['new_amount'],
    },
  });
  await defineResource(t, {
    singular: 'notification',
    plural: 'notifications',
    parents: ['user'],
    schema: {
      type: 'object',
      properties: { title: { type: 'string' }, read: { type: 'boolean' } },
    },
  });
  await defineResource(t, {
    singular: 'profile',
    plural: 'profiles',
    parents: ['user'],
    singleton: true,
    schema: { type: 'object', properties: { bio: { type: 'string' } } },
  });

  const res = await call(t.engine, 'GET', '/openapi.json');
  expect(res.status).toBe(200); // openapi.json is auth-exempt
  doc = await res.json();
});

describe('snapshot invariants vs the Go server', () => {
  test('same path set', () => {
    expect(Object.keys(doc.paths).sort()).toEqual(Object.keys(goSnapshot.paths).sort());
  });

  test('same operations per path', () => {
    for (const [path, ops] of Object.entries(goSnapshot.paths)) {
      expect(Object.keys(doc.paths[path]).sort()).toEqual(
        Object.keys(ops as object).sort(),
      );
    }
  });

  test('same operationIds and parameter names', () => {
    for (const [path, ops] of Object.entries(goSnapshot.paths) as [string, Record<string, any>][]) {
      for (const [method, op] of Object.entries(ops) as [string, any][]) {
        const ours = doc.paths[path][method];
        expect(ours.operationId).toBe(op['operationId']);
        const goParams = ((op['parameters'] ?? []) as { name: string }[]).map((p) => p.name);
        const ourParams = ((ours.parameters ?? []) as { name: string }[]).map((p) => p.name);
        expect(ourParams.sort()).toEqual(goParams.sort());
      }
    }
  });

  test('same component schemas with matching x-aep-resource', () => {
    const goSchemas = goSnapshot.components.schemas as unknown as Record<string, any>;
    expect(Object.keys(doc.components.schemas).sort()).toEqual(Object.keys(goSchemas).sort());
    for (const [name, goSchema] of Object.entries(goSchemas)) {
      const ours = doc.components.schemas[name];
      expect(ours['x-aep-resource']).toEqual(goSchema['x-aep-resource']);
      expect(Object.keys(ours.properties).sort()).toEqual(
        Object.keys(goSchema['properties']).sort(),
      );
      expect(ours.required ?? []).toEqual(goSchema['required'] ?? []);
    }
  });

  test('same response status codes per operation', () => {
    for (const [path, ops] of Object.entries(goSnapshot.paths) as [string, Record<string, any>][]) {
      for (const [method, op] of Object.entries(ops) as [string, any][]) {
        expect(Object.keys(doc.paths[path][method].responses).sort()).toEqual(
          Object.keys(op['responses']).sort(),
        );
      }
    }
  });

  test('file fields carry x-aepbase-file-field', () => {
    const prop = doc.components.schemas['gift-card'].properties['front_image'];
    expect(prop['x-aepbase-file-field']).toBe(true);
    expect(prop['type']).toBe('binary');
  });
});

describe('aep-lib-ts consumer round-trip', () => {
  test('fromOpenAPI + patchCreateMethods derives the full resource model', async () => {
    const apiClient = await APIClient.fromOpenAPI(doc, 'http://localhost:8090');
    const resources = apiClient.resources();

    // The CLI's patchCreateMethods compensation (create declares 201).
    for (const resource of Object.values(resources)) {
      const r = resource as {
        createMethod?: { supportsUserSettableCreate: boolean };
        patternElems: string[];
      };
      if (r.createMethod) continue;
      const collectionPath = `/${r.patternElems.slice(0, -1).join('/')}`;
      const post = doc.paths[collectionPath]?.['post'] as
        | { parameters?: { name: string }[] }
        | undefined;
      if (!post) continue;
      r.createMethod = {
        supportsUserSettableCreate: post.parameters?.some((p) => p.name === 'id') ?? false,
      };
    }

    // Parity bar: the same resource set aep-lib-ts derives from the Go doc.
    // (Singletons like `profile` are invisible to fromOpenAPI for both —
    // their GET response isn't a list envelope — so neither doc surfaces it.)
    const goClient = await APIClient.fromOpenAPI(
      goSnapshot as never,
      'http://localhost:8090',
    );
    expect(Object.keys(resources).sort()).toEqual(Object.keys(goClient.resources()).sort());

    const giftCard = resources['gift-card'] as {
      plural: string;
      patternElems: string[];
      getMethod?: object;
      listMethod?: { supportsFilter: boolean; supportsSkip: boolean };
      updateMethod?: object;
      deleteMethod?: object;
      createMethod?: { supportsUserSettableCreate: boolean };
    };
    expect(giftCard.plural).toBe('gift-cards');
    expect(giftCard.patternElems).toEqual(['gift-cards', '{gift_card_id}']);
    expect(giftCard.getMethod).toBeDefined();
    expect(giftCard.updateMethod).toBeDefined();
    expect(giftCard.deleteMethod).toBeDefined();
    expect(giftCard.listMethod?.supportsFilter).toBe(true);
    expect(giftCard.listMethod?.supportsSkip).toBe(true);
    expect(giftCard.createMethod?.supportsUserSettableCreate).toBe(true);

    const notification = resources['notification'] as typeof giftCard & {
      parents: { singular: string }[];
    };
    expect(notification.patternElems).toEqual([
      'users',
      '{user_id}',
      'notifications',
      '{notification_id}',
    ]);
    expect(notification.createMethod?.supportsUserSettableCreate).toBe(false);
  });
});
