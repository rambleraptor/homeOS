/**
 * E2E: AEP-151 long-running operations.
 *
 * Drives the real async method — `hsa-receipts:parse-receipt` — end to end:
 * the call returns 202 + an operation, the AI parse runs in the background,
 * and the notifications app tracks it. The AI provider is a local stub (see
 * config/ai-stub.ts) so no paid model is called; the stub's deliberate delay is
 * what keeps the operation observably `running`.
 *
 * Operations are a top-level, household-shared collection (not user-scoped), so
 * each test cleans up the records it creates.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { NotificationsPage } from '../../pages/NotificationsPage';
import { aepList, aepRemove, postCustomMethod } from '../../utils/aepbase-helpers';
import { FAIL_IMAGE, OK_IMAGE } from '../../config/ai-stub';

interface OperationRecord {
  id: string;
  done: boolean;
  status?: string;
  title?: string;
  response?: { data?: { merchant?: string } };
}

const OPERATIONS = 'operations';
const PARSE_RECEIPT = '/hsa-receipts:parse-receipt';

test.describe('Operations (AEP-151)', () => {
  const createdIds: string[] = [];

  // Never leave an operation behind — a stray "running" one would spin the
  // bell for every later test.
  test.afterEach(async ({ adminToken }) => {
    for (const id of createdIds.splice(0)) {
      await aepRemove(adminToken, OPERATIONS, id).catch(() => {});
    }
  });

  /** Invoke the real async method; returns the 202 operation it spawned. */
  async function startParse(token: string, image: string): Promise<OperationRecord> {
    const res = await postCustomMethod(token, PARSE_RECEIPT, {
      image,
      mimeType: 'image/png',
    });
    expect(res.status).toBe(202);
    const operation = (await res.json()) as OperationRecord;
    expect(operation.done).toBe(false);
    createdIds.push(operation.id);
    return operation;
  }

  test('bell spins and the Operations tab tracks a real parse to completion', async ({
    authenticatedPage,
    userToken,
  }) => {
    const operation = await startParse(userToken, OK_IMAGE);

    const notifications = new NotificationsPage(authenticatedPage);
    await notifications.goto();

    // The bell wears a spinner while the parse runs.
    await expect(notifications.bellSpinner).toBeVisible({ timeout: 30_000 });

    // The Operations tab lists it under the method's declared title.
    await notifications.openOperationsTab();
    const row = notifications.operationRow(operation.id);
    await expect(row).toBeVisible();
    await expect(row).toContainText('Parse receipt');
    await expect(row).toContainText(/running/i);

    // The background parse finishes; the polling UI notices and the bell clears.
    await expect(row).toContainText(/completed/i, { timeout: 20_000 });
    await expect(notifications.bellSpinner).toBeHidden();
  });

  test('a completed operation carries the parsed receipt as its response', async ({
    userToken,
  }) => {
    const operation = await startParse(userToken, OK_IMAGE);

    // Poll the operation the way a client does, until it settles.
    await expect
      .poll(
        async () => {
          const [record] = (await aepList<OperationRecord>(userToken, OPERATIONS)).filter(
            (o) => o.id === operation.id,
          );
          return record?.done ?? false;
        },
        { timeout: 20_000 },
      )
      .toBe(true);

    const [settled] = (await aepList<OperationRecord>(userToken, OPERATIONS)).filter(
      (o) => o.id === operation.id,
    );
    expect(settled.status).toBe('succeeded');
    expect(settled.response?.data?.merchant).toBe('CVS Pharmacy');
  });

  test('a parse that finds nothing fails the operation and shows the error', async ({
    authenticatedPage,
    userToken,
  }) => {
    // The stub returns an empty object for this image, so the real handler
    // throws and the failure lands on the operation.
    const operation = await startParse(userToken, FAIL_IMAGE);

    const notifications = new NotificationsPage(authenticatedPage);
    await notifications.goto();
    await notifications.openOperationsTab();

    const row = notifications.operationRow(operation.id);
    await expect(row).toBeVisible();
    await expect(row).toContainText(/failed/i, { timeout: 20_000 });
    await expect(row).toContainText('No receipt data found in image');
    await expect(notifications.bellSpinner).toBeHidden();
  });

  test('an async method rejected pre-flight returns an error, not an operation', async ({
    userToken,
  }) => {
    // AEP-151: errors that stop the operation starting are ordinary error
    // responses. A non-image mimeType fails `validate` before anything exists.
    const before = await aepList<OperationRecord>(userToken, OPERATIONS);

    const res = await postCustomMethod(userToken, PARSE_RECEIPT, {
      image: OK_IMAGE,
      mimeType: 'application/zip',
    });
    expect(res.status).toBe(400);

    const after = await aepList<OperationRecord>(userToken, OPERATIONS);
    expect(after.length).toBe(before.length);
  });
});
