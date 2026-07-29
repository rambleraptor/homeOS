/**
 * End-to-end for the documents cleanup feature: an app declares a back-reference
 * with `onDelete: 'cascade'` in the authoring `FieldDef` shape; the translator
 * emits the `x-aepbase-reference` marker; the engine acts on it at delete time.
 *
 * This closes the seam between the two units tested elsewhere — the translator
 * (`homestead-core` translate tests) and the engine matcher (`references.test.ts`)
 * — using the real translator output and a path-format (`documents/{id}`) value,
 * exactly as the `post_classify` hooks store it.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { toWireSchema } from '@rambleraptor/homestead-core/resources/translate';
import { call, defineResource, makeEngine, type TestEngine } from './helpers';

let t: TestEngine;
beforeEach(async () => {
  t = await makeEngine();
});

describe('post-classify resource cascades on document delete', () => {
  test('deleting a document deletes the receipt derived from it', async () => {
    await defineResource(t, {
      singular: 'document',
      plural: 'documents',
      user_settable_create: true,
      schema: { type: 'object', properties: { title: { type: 'string' } } },
    });

    // The receipt schema, translated from the same authoring shape hsa uses.
    const receiptSchema = toWireSchema(
      {
        merchant: { type: 'string', required: true },
        source_document: {
          type: 'string',
          reference: { resource: 'document', onDelete: 'cascade' },
        },
      },
      'hsa-receipt',
    );
    // The translator must have emitted the reference marker for the engine.
    expect(
      (receiptSchema.properties.source_document as Record<string, unknown>)[
        'x-aepbase-reference'
      ],
    ).toEqual({ resource: 'document', onDelete: 'cascade' });

    await defineResource(t, {
      singular: 'hsa-receipt',
      plural: 'hsa-receipts',
      user_settable_create: true,
      schema: receiptSchema,
    });

    const docId = (await (await call(t.engine, 'POST', '/documents', {
      token: t.adminToken,
      body: { title: 'CVS receipt' },
    })).json()).id as string;

    const receiptId = (await (await call(t.engine, 'POST', '/hsa-receipts', {
      token: t.adminToken,
      // Stored exactly as the post_classify hook writes it: a path.
      body: { merchant: 'CVS', source_document: `documents/${docId}` },
    })).json()).id as string;

    expect((await call(t.engine, 'DELETE', `/documents/${docId}`, { token: t.adminToken })).status).toBe(204);
    expect((await call(t.engine, 'GET', `/hsa-receipts/${receiptId}`, { token: t.adminToken })).status).toBe(404);
  });
});
