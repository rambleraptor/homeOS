/**
 * E2E: AEP-151 long-running operations.
 *
 * Covers the surfaces unit tests can't: the notifications app's Operations tab
 * and the top-bar bell that spins while work is in flight.
 *
 * Operations are seeded over REST rather than by driving a real async method —
 * the only one (`hsa-receipts:parse-receipt`) needs an AI key the e2e server
 * doesn't have, and seeding keeps the test deterministic and fast. The
 * dispatcher's async path is covered by unit tests; the last test here pins the
 * pre-flight behaviour that needs no AI.
 *
 * Operations are a top-level, household-shared collection (not user-scoped), so
 * each test cleans up the records it creates.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { NotificationsPage } from '../../pages/NotificationsPage';
import {
  aepCreate,
  aepList,
  aepRemove,
  aepUpdate,
  postCustomMethod,
} from '../../utils/aepbase-helpers';

interface OperationRecord {
  id: string;
}

const OPERATIONS = 'operations';

test.describe('Operations (AEP-151)', () => {
  const createdIds: string[] = [];

  // Never leave a "running" operation behind — the bell would spin for
  // every later test.
  test.afterEach(async ({ adminToken }) => {
    for (const id of createdIds.splice(0)) {
      await aepRemove(adminToken, OPERATIONS, id).catch(() => {});
    }
  });

  async function seedOperation(
    token: string,
    fields: Record<string, unknown>,
  ): Promise<OperationRecord> {
    const operation = await aepCreate<OperationRecord>(token, OPERATIONS, {
      method: 'hsa-receipts:parse-receipt',
      title: 'Parse receipt',
      ...fields,
    });
    createdIds.push(operation.id);
    return operation;
  }

  test('bell spins and the Operations tab tracks a running operation to completion', async ({
    authenticatedPage,
    userToken,
  }) => {
    const operation = await seedOperation(userToken, {
      done: false,
      status: 'running',
    });

    const notifications = new NotificationsPage(authenticatedPage);
    await notifications.goto();

    // The bell wears a spinner while the operation runs.
    await expect(notifications.bellSpinner).toBeVisible({ timeout: 30_000 });

    // The Operations tab lists it as running.
    await notifications.openOperationsTab();
    const row = notifications.operationRow(operation.id);
    await expect(row).toBeVisible();
    await expect(row).toContainText('Parse receipt');
    await expect(row).toContainText(/running/i);

    // Finish it server-side; the polling query should pick the change up.
    await aepUpdate(userToken, OPERATIONS, operation.id, {
      done: true,
      status: 'succeeded',
      response: { message: 'Receipt parsed successfully' },
    });

    await expect(row).toContainText(/completed/i, { timeout: 20_000 });
    await expect(notifications.bellSpinner).toBeHidden();
  });

  test('a failed operation shows its error and does not spin the bell', async ({
    authenticatedPage,
    userToken,
  }) => {
    const operation = await seedOperation(userToken, {
      done: true,
      status: 'failed',
      error: { message: 'No receipt data found in image' },
    });

    const notifications = new NotificationsPage(authenticatedPage);
    await notifications.goto();
    await notifications.openOperationsTab();

    const row = notifications.operationRow(operation.id);
    await expect(row).toBeVisible();
    await expect(row).toContainText(/failed/i);
    await expect(row).toContainText('No receipt data found in image');
    await expect(notifications.bellSpinner).toBeHidden();
  });

  test('an async method rejected pre-flight returns an error, not an operation', async ({
    userToken,
  }) => {
    // The e2e server runs without an AI key, so parse-receipt's `validate`
    // must reject with a plain 503 before any operation exists — AEP-151:
    // errors that stop the operation starting are ordinary error responses.
    const before = await aepList<OperationRecord>(userToken, OPERATIONS);

    const res = await postCustomMethod(userToken, '/hsa-receipts:parse-receipt', {
      image: 'ZmFrZQ==',
      mimeType: 'image/png',
    });
    expect(res.status).toBe(503);

    const after = await aepList<OperationRecord>(userToken, OPERATIONS);
    expect(after.length).toBe(before.length);
  });
});
