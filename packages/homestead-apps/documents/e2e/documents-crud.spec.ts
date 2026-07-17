/**
 * Documents E2E.
 *
 * Drives the real `documents:classify` async method end to end against the AI
 * stub (config/ai-stub.ts): upload a file, the classify call returns 202 + an
 * operation, the background parse writes the result back, and the list reflects
 * it. The stub is steered by the uploaded file's bytes — a `match` file parses
 * as a 1099-INT, `unknown` as unrecognised, `fail` throws in the model call.
 *
 * Documents are a top-level, household-shared collection, so each test cleans up
 * the documents and operations it creates.
 */

import { test, expect } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import { DOC_MARKERS } from '../../../../tests/e2e/config/ai-stub';
import { DocumentsPage } from './DocumentsPage';
import {
  classifyDocument,
  deleteAllDocuments,
  deleteAllOperations,
  listDocuments,
  listOperations,
  uploadAndClassify,
  uploadDocument,
  waitForParse,
} from './helpers';

test.describe('Documents', () => {
  test.beforeEach(async ({ userToken }) => {
    await deleteAllDocuments(userToken);
    await deleteAllOperations(userToken);
  });

  test.afterEach(async ({ userToken }) => {
    await deleteAllDocuments(userToken);
    await deleteAllOperations(userToken);
  });

  test('uploading in the UI classifies a 1099 and renders its fields from the YAML', async ({
    authenticatedPage,
  }) => {
    const documents = new DocumentsPage(authenticatedPage);
    await documents.goto();
    await documents.expectEmpty();

    // A file whose bytes are the "match" marker: the stub reads it as a 1099-INT.
    await documents.uploadFile('form-1099.pdf', 'application/pdf', DOC_MARKERS.match);

    // The card appears immediately (pending) and the polling list resolves it.
    const card = documents.card('form-1099');
    await expect(card).toBeVisible();
    await expect(documents.status('form-1099')).toContainText(/parsed/i, { timeout: 30_000 });

    // The type label comes from the doc type's YAML `label`.
    await expect(documents.type('form-1099')).toContainText('Form 1099-INT');

    // Fields are rendered from the YAML declaration — label from `label`, value
    // from the parsed metadata. No component hardcodes what a 1099 is.
    await expect(documents.field('form-1099', 'payer_name')).toContainText('Payer name');
    await expect(documents.field('form-1099', 'payer_name')).toContainText('Ally Bank');
    await expect(documents.field('form-1099', 'box_1_interest')).toContainText(
      'Box 1: Interest income',
    );
    await expect(documents.field('form-1099', 'box_1_interest')).toContainText('412.55');
  });

  test('a document matching no known type is shown as unmatched, not failed', async ({
    userToken,
    authenticatedPage,
  }) => {
    const doc = await uploadAndClassify(userToken, 'unknown', { title: 'mystery-letter' });
    expect(doc.parse_status).toBe('unmatched');
    expect(doc.metadata?.doc_type).toBe('unknown');

    const documents = new DocumentsPage(authenticatedPage);
    await documents.goto();
    await expect(documents.status('mystery-letter')).toContainText(/no matching type/i, {
      timeout: 30_000,
    });
  });

  test('parsed metadata is filterable through the union columns', async ({ userToken }) => {
    const parsed = await uploadAndClassify(userToken, 'match', { title: 'ally-1099' });
    const unmatched = await uploadAndClassify(userToken, 'unknown', { title: 'a-letter' });
    expect(parsed.parse_status).toBe('parsed');

    // Filter on the discriminator tag — a Phase 1 derived column.
    const byType = await listDocuments(userToken, "metadata.doc_type == 'form-1099-int'");
    expect(byType.map((d) => d.id)).toContain(parsed.id);
    expect(byType.map((d) => d.id)).not.toContain(unmatched.id);

    // Filter on a variant field, numerically.
    const overHundred = await listDocuments(userToken, 'metadata.box_1_interest > 100');
    expect(overHundred.map((d) => d.id)).toContain(parsed.id);

    const overThousand = await listDocuments(userToken, 'metadata.box_1_interest > 1000');
    expect(overThousand.map((d) => d.id)).not.toContain(parsed.id);
  });

  test('classify rejects an unsupported file type pre-flight, creating no operation', async ({
    userToken,
  }) => {
    // Stored with an unsupported mime, so `validate` rejects before an operation
    // exists — an ordinary 400, not a 202 followed by a failed operation.
    const doc = await uploadDocument(userToken, 'match', {
      title: 'a-zip',
      mimeType: 'application/zip',
    });
    const before = (await listOperations(userToken)).length;

    const { status } = await classifyDocument(userToken, doc.id);
    expect(status).toBe(400);

    const after = (await listOperations(userToken)).length;
    expect(after).toBe(before);
  });

  test('a model failure marks the document failed', async ({ userToken }) => {
    // The "fail" marker makes the stub return a schema-invalid object, so the
    // real extraction throws and the failure lands on the document.
    const doc = await uploadDocument(userToken, 'fail', { title: 'broken-scan' });
    const { status } = await classifyDocument(userToken, doc.id);
    expect(status).toBe(202);

    const settled = await waitForParse(userToken, doc.id);
    expect(settled.parse_status).toBe('failed');
  });
});
