/**
 * Unit tests for injectCustomMethods — the server-layer enrichment that adds
 * app-declared AEP-136 custom methods to the engine's OpenAPI doc as
 * first-class `:verb` paths.
 */

import { describe, expect, test } from 'vitest';
import type { ResourceCustomMethod } from '@rambleraptor/homestead-core/resources/types';
import { injectCustomMethods } from '../../src/routes/openapi-custom-methods';

// A resource path set shaped like the engine emits: a top-level collection
// (groceries) and a user-parented resource with collection + item paths.
function baseDoc() {
  return {
    openapi: '3.1.0',
    paths: {
      '/groceries': { get: {}, post: {} },
      '/groceries/{grocery_id}': { get: {} },
      '/users/{user_id}/notification-subscriptions': { get: {}, post: {} },
      '/users/{user_id}/notification-subscriptions/{notification_subscription_id}':
        { get: {}, patch: {}, delete: {} },
    },
    components: { schemas: {} },
  };
}

// Minimal ResourceCustomMethod — `load` is never called by the injector.
function method(m: Partial<ResourceCustomMethod>): ResourceCustomMethod {
  return { load: async () => ({ default: async () => new Response() }), ...m };
}

describe('injectCustomMethods', () => {
  test('adds an item-target method with reconstructed path params', () => {
    const doc = baseDoc();
    injectCustomMethods(doc, {
      'notification-subscriptions:send-notification': method({
        target: 'item',
        description: 'Send to this device.',
        request: { type: 'object', properties: { title: { type: 'string' } } },
        response: { type: 'object', properties: { sent: { type: 'integer' } } },
      }),
    });

    const key =
      '/users/{user_id}/notification-subscriptions/{notification_subscription_id}:send-notification';
    const op = (doc.paths as Record<string, any>)[key]?.post;
    expect(op).toBeDefined();
    expect(op.operationId).toBe(
      'send_notification_notification_subscriptions',
    );
    expect(op.description).toBe('Send to this device.');
    // Both path params reconstructed from the template, in order, required.
    expect(op.parameters.map((p: any) => p.name)).toEqual([
      'user_id',
      'notification_subscription_id',
    ]);
    expect(op.parameters.every((p: any) => p.in === 'path' && p.required)).toBe(
      true,
    );
    expect(op.requestBody.content['application/json'].schema).toEqual({
      type: 'object',
      properties: { title: { type: 'string' } },
    });
    expect(op.responses['200'].content['application/json'].schema).toEqual({
      type: 'object',
      properties: { sent: { type: 'integer' } },
    });
  });

  test('collection-target method attaches to the collection path with no path params', () => {
    const doc = baseDoc();
    injectCustomMethods(doc, {
      'groceries:send-notification': method({ target: 'collection' }),
    });

    const op = (doc.paths as Record<string, any>)['/groceries:send-notification']
      ?.post;
    expect(op).toBeDefined();
    expect(op.parameters).toEqual([]);
    // No declared schema → no requestBody, generic 200.
    expect(op.requestBody).toBeUndefined();
    expect(op.responses['200'].content['application/json'].schema).toEqual({
      type: 'object',
    });
  });

  test('async method emits 202 + x-aep-long-running-operation', () => {
    const doc = baseDoc();
    injectCustomMethods(doc, {
      'groceries:parse': method({
        target: 'collection',
        async: true,
        response: { type: 'object', properties: { ok: { type: 'boolean' } } },
      }),
    });

    const op = (doc.paths as Record<string, any>)['/groceries:parse']?.post;
    expect(op.responses['202']).toBeDefined();
    expect(op.responses['200']).toBeUndefined();
    expect(op['x-aep-long-running-operation'].response.schema).toEqual({
      type: 'object',
      properties: { ok: { type: 'boolean' } },
    });
  });

  test('respects a non-POST http method', () => {
    const doc = baseDoc();
    injectCustomMethods(doc, {
      'groceries:export': method({ target: 'collection', method: 'GET' }),
    });
    const path = (doc.paths as Record<string, any>)['/groceries:export'];
    expect(path.get).toBeDefined();
    expect(path.post).toBeUndefined();
  });

  test('skips a method whose resource is absent from the doc (no throw)', () => {
    const doc = baseDoc();
    expect(() =>
      injectCustomMethods(doc, {
        'nonexistent:frob': method({ target: 'collection' }),
      }),
    ).not.toThrow();
    expect(
      (doc.paths as Record<string, any>)['/nonexistent:frob'],
    ).toBeUndefined();
  });
});
