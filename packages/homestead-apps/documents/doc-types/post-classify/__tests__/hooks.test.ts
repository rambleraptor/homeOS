/**
 * post_classify hook handlers: how a classified document's metadata maps onto
 * the HSA receipt / recipe it creates. The shared homestead-client is mocked, so
 * these assert the body built for the downstream resource and the returned link —
 * the field coercions (date widening, enum fallback, null-dropping) are what break.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createFakeServerClient } from '@rambleraptor/homestead-core/server/__tests__/fake-server-client';
import type { Document } from '../../../types';

const fake = createFakeServerClient();
const serverClientTokens: string[] = [];
vi.mock('@rambleraptor/homestead-core/server/client', () => ({
  serverClient: (token: string) => {
    serverClientTokens.push(token);
    return fake.client;
  },
}));

const { createFn, listAllFn } = fake;

import medicalReceiptHook from '../medical-receipt.server';
import recipeHook from '../recipe.server';

const auth = {
  token: 'tok',
  user: { id: 'u1', path: 'users/u1', email: 'a@b.c' },
};

const doc = (over: Partial<Document> = {}): Document => ({
  id: 'doc1',
  path: 'documents/doc1',
  title: 'A document',
  created_by: 'users/u1',
  create_time: '2026-01-02T03:04:05.000Z',
  ...over,
});

beforeEach(() => {
  createFn.mockReset();
  createFn.mockResolvedValue({ id: 'created1' });
  listAllFn.mockReset();
  listAllFn.mockResolvedValue([]); // no people to match unless a test says so
  serverClientTokens.length = 0;
});

describe('medical-receipt post_classify', () => {
  it('maps receipt metadata onto an hsa-receipt linked to the document', async () => {
    const result = await medicalReceiptHook({
      document: doc({ title: 'CVS receipt' }),
      metadata: {
        doc_type: 'medical-receipt',
        merchant: 'CVS Pharmacy',
        purchase_date: '2026-03-15',
        amount_paid: 42.5,
        category: 'Rx',
        patient: 'Jamie',
        items: 'Amoxicillin, dispensing fee',
        payment_method: 'card',
        tax: 0,
      },
      auth,
    });

    expect(createFn).toHaveBeenCalledTimes(1);
    const [path, body] = createFn.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe('/hsa-receipts');
    expect(serverClientTokens).toContain('tok');
    expect(body).toMatchObject({
      merchant: 'CVS Pharmacy',
      service_date: '2026-03-15T00:00:00.000Z',
      amount: 42.5,
      category: 'Rx',
      status: 'Stored',
      patient: 'Jamie',
      source_document: 'documents/doc1',
      created_by: 'users/u1',
    });
    expect(body.notes).toContain('Items: Amoxicillin, dispensing fee');
    expect(body.notes).toContain('Paid by: card');
    expect(result).toEqual({ linked_resource: 'hsa-receipts/created1' });
  });

  it('links the receipt to a person on an unambiguous patient-name match', async () => {
    listAllFn.mockResolvedValue([
      { id: 'p1', name: 'Jamie', aliases: [] },
      { id: 'p2', name: 'Alex', aliases: ['Alexander'] },
    ]);

    await medicalReceiptHook({
      document: doc(),
      metadata: { doc_type: 'medical-receipt', patient: 'Jamie' },
      auth,
    });

    const [path, body] = createFn.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe('/hsa-receipts');
    expect(serverClientTokens).toContain('tok');
    expect(listAllFn).toHaveBeenCalledWith('/people', undefined);
    expect(body.patient).toBe('Jamie');
    expect(body.person).toBe('people/p1');
  });

  it('matches a patient name against a person alias', async () => {
    listAllFn.mockResolvedValue([{ id: 'p2', name: 'Alex', aliases: ['Alexander'] }]);

    await medicalReceiptHook({
      document: doc(),
      metadata: { doc_type: 'medical-receipt', patient: 'alexander' },
      auth,
    });

    const [, body] = createFn.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.person).toBe('people/p2');
  });

  it('leaves person unset when the patient name is ambiguous or unknown', async () => {
    listAllFn.mockResolvedValue([
      { id: 'p1', name: 'Jamie', aliases: [] },
      { id: 'p3', name: 'Jamie', aliases: [] }, // two people named Jamie → ambiguous
    ]);

    await medicalReceiptHook({
      document: doc(),
      metadata: { doc_type: 'medical-receipt', patient: 'Jamie' },
      auth,
    });

    const [, body] = createFn.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.patient).toBe('Jamie');
    expect(body.person).toBeUndefined();
  });

  it('still creates the receipt when the people lookup fails', async () => {
    listAllFn.mockRejectedValue(new Error('boom'));

    await medicalReceiptHook({
      document: doc(),
      metadata: { doc_type: 'medical-receipt', patient: 'Jamie' },
      auth,
    });

    expect(createFn).toHaveBeenCalledTimes(1);
    const [, body] = createFn.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.patient).toBe('Jamie');
    expect(body.person).toBeUndefined();
  });

  it('falls back to a valid category and the document date/title when absent', async () => {
    await medicalReceiptHook({
      document: doc({ title: 'Scan 001' }),
      metadata: { doc_type: 'medical-receipt', category: 'Wellness' },
      auth,
    });
    const [, body] = createFn.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.category).toBe('Medical'); // 'Wellness' is not an HSA category
    expect(body.merchant).toBe('Scan 001'); // no merchant → document title
    expect(body.amount).toBe(0); // no amount → 0
    expect(body.service_date).toBe('2026-01-02T03:04:05.000Z'); // no date → doc create_time
  });
});

describe('recipe post_classify', () => {
  it('maps recipe metadata onto a recipe, dropping per-ingredient nulls', async () => {
    const result = await recipeHook({
      document: doc({ title: 'Banana bread' }),
      metadata: {
        doc_type: 'recipe',
        parsed_ingredients: [
          { item: 'flour', qty: 2, unit: 'cup', raw: '2 cups flour' },
          { item: 'salt', qty: null, unit: null, raw: 'a pinch of salt' },
        ],
        steps: ['Mix', 'Bake'],
        tags: ['dessert', null],
        prep_time: '10 mins',
        method: 'Grease the pan.',
      },
      auth,
    });

    expect(createFn).toHaveBeenCalledTimes(1);
    const [path, body] = createFn.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe('/recipes');
    expect(body.title).toBe('Banana bread');
    expect(body.parsed_ingredients).toEqual([
      { item: 'flour', qty: 2, unit: 'cup', raw: '2 cups flour' },
      { item: 'salt', raw: 'a pinch of salt' }, // null qty/unit dropped
    ]);
    expect(body.steps).toEqual(['Mix', 'Bake']);
    expect(body.tags).toEqual(['dessert']); // null tag dropped
    expect(body.prep_time).toBe('10 mins');
    expect(body.method).toBe('Grease the pan.');
    expect(body.source_document).toBeUndefined();
    expect(body.source_pointer).toBe('documents/doc1'); // no printed source → back-link
    expect(result).toEqual({ linked_resource: 'recipes/created1' });
  });

  it('defaults required fields when the read is empty', async () => {
    await recipeHook({
      document: doc({ title: undefined }),
      metadata: { doc_type: 'recipe' },
      auth,
    });
    const [, body] = createFn.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.title).toBe('Untitled recipe');
    expect(body.parsed_ingredients).toEqual([]);
  });
});
