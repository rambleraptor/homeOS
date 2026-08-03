/**
 * E2E: AEP-151 long-running operations.
 *
 * Drives a real async method — `documents:classify` — end to end: the call
 * returns 202 + an operation, the AI classification runs in the background, and
 * the superuser-only Operations app tracks it. The AI provider is a local stub
 * (see config/ai-stub.ts) so no paid model is called; the stub's deliberate
 * delay is what keeps the operation observably `running`.
 *
 * Operations are a top-level, household-shared collection (not user-scoped), so
 * a regular user can spawn one and a superuser sees it in the Operations app.
 * Each test starts from a cleared collection (see beforeEach).
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { OperationsPage } from '../../pages/OperationsPage';
import { listOrEmpty } from '../../utils/aepbase-helpers';
import {
  classifyDocument,
  deleteAllDocuments,
  deleteAllOperations,
  listOperations,
  uploadDocument,
  type DocumentKind,
} from '../../../../packages/homestead-apps/documents/e2e/helpers';

interface OperationRecord {
  id: string;
  done: boolean;
  status?: string;
  title?: string;
  response?: { doc_type?: string; parse_status?: string; message?: string };
}

const OPERATIONS = 'operations';

test.describe('Operations (AEP-151)', () => {
  // Operations and documents are top-level, household-shared collections, so
  // clear both around every test — a stray "running" operation would keep the
  // Operations page polling into the next test, and leftover records would
  // break the pre-flight count assertion below.
  test.beforeEach(async ({ userToken }) => {
    await deleteAllDocuments(userToken);
    await deleteAllOperations(userToken);
  });

  test.afterEach(async ({ userToken }) => {
    await deleteAllDocuments(userToken);
    await deleteAllOperations(userToken);
  });

  /**
   * Upload a document and invoke the real async classify method on it; returns
   * the 202 operation it spawned. `kind` steers the AI stub (see ai-stub.ts).
   */
  async function startClassify(
    token: string,
    kind: DocumentKind,
  ): Promise<OperationRecord> {
    const doc = await uploadDocument(token, kind, { title: `${kind}-doc` });
    const { status, operation } = await classifyDocument(token, doc.id);
    expect(status).toBe(202);
    expect(operation?.done).toBe(false);
    return operation as OperationRecord;
  }

  test('the Operations page tracks a real classification to completion', async ({
    authenticatedAdminPage,
    userToken,
  }) => {
    // A regular member kicks off the classify; the superuser watches it land.
    const operation = await startClassify(userToken, 'match');

    const operations = new OperationsPage(authenticatedAdminPage);
    await operations.goto();

    // The page lists it under the method's declared title, still running.
    const row = operations.operationRow(operation.id);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText('Classify document');
    await expect(row).toContainText(/running/i);

    // The background classification finishes; the polling UI notices.
    await expect(row).toContainText(/completed/i, { timeout: 20_000 });
  });

  test('a completed operation carries the classification as its response', async ({
    userToken,
  }) => {
    const operation = await startClassify(userToken, 'match');

    // Poll the operation the way a client does, until it settles.
    await expect
      .poll(
        async () => {
          const [record] = (await listOrEmpty<OperationRecord>(userToken, OPERATIONS)).filter(
            (o) => o.id === operation.id,
          );
          return record?.done ?? false;
        },
        { timeout: 20_000 },
      )
      .toBe(true);

    const [settled] = (await listOrEmpty<OperationRecord>(userToken, OPERATIONS)).filter(
      (o) => o.id === operation.id,
    );
    expect(settled.status).toBe('succeeded');
    expect(settled.response?.doc_type).toBe('form-1099-int');
    expect(settled.response?.parse_status).toBe('parsed');
  });

  test('a classification that fails surfaces the error on the operation', async ({
    authenticatedAdminPage,
    userToken,
  }) => {
    // The stub returns a schema-violating object for this document, so the real
    // handler throws and the failure lands on the operation.
    const operation = await startClassify(userToken, 'fail');

    const operations = new OperationsPage(authenticatedAdminPage);
    await operations.goto();

    const row = operations.operationRow(operation.id);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(/failed/i, { timeout: 20_000 });
  });

  test('an async method rejected pre-flight returns an error, not an operation', async ({
    userToken,
  }) => {
    // AEP-151: errors that stop the operation starting are ordinary error
    // responses. An unsupported mime type fails `validate` before anything
    // exists — a plain 400, not a 202 followed by a failed operation.
    const doc = await uploadDocument(userToken, 'match', {
      title: 'zip-doc',
      mimeType: 'application/zip',
    });

    // Snapshot immediately before the call, so the window the count spans is
    // just the classify itself — an unrelated operation (e.g. the cleanup cron's
    // own) can't slip in between the two reads and skew the delta.
    const before = await listOperations(userToken);
    const { status } = await classifyDocument(userToken, doc.id);
    expect(status).toBe(400);

    const after = await listOperations(userToken);
    expect(after.length).toBe(before.length);
  });
});
