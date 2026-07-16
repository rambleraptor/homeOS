/**
 * E2E: AEP-151 long-running operations.
 *
 * Triggers an async custom method (`groceries:demo-slow`) via the API, then
 * verifies through the UI that:
 *   - the top-bar bell turns into a spinner while the operation runs,
 *   - the notifications app's Operations tab lists the running operation, and
 *   - both resolve once the operation completes.
 *
 * Operations are a top-level, household-shared collection (not user-scoped),
 * so the test cleans up the record it creates.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { NotificationsPage } from '../../pages/NotificationsPage';
import { postCustomMethod, aepRemove } from '../../utils/aepbase-helpers';

// A generous budget: dev-mode compiles the notifications route's lazy chunk on
// first hit, and the operation itself runs for several seconds.
test.setTimeout(90_000);

test.describe('Operations (AEP-151)', () => {
  test('spins the bell and lists a running operation until it completes', async ({
    authenticatedPage,
    userToken,
    adminToken,
  }) => {
    const notifications = new NotificationsPage(authenticatedPage);

    // Warm the notifications route so the reload below is fast (its lazy chunk
    // compiles here, before any operation is in flight).
    await notifications.goto();
    await expect(authenticatedPage.getByTestId('operations-tab')).toBeVisible({
      timeout: 30_000,
    });

    // Trigger a long-running async method. The delay keeps it in the running
    // state long enough to observe the spinner UI.
    const operation = await postCustomMethod<{ id: string; done: boolean }>(
      userToken,
      '/groceries:demo-slow',
      { delay_ms: 12_000 },
    );
    expect(operation.done).toBe(false);

    // Reload so the freshly-mounted operations query discovers the in-flight
    // operation and starts polling.
    await authenticatedPage.reload();
    await expect(authenticatedPage.getByTestId('operations-tab')).toBeVisible({
      timeout: 30_000,
    });

    // The top-bar bell shows a spinner while the operation runs.
    await expect(notifications.bellSpinner).toBeVisible({ timeout: 15_000 });

    // The Operations tab lists the running operation.
    await notifications.openOperationsTab();
    const row = notifications.operationRow(operation.id);
    await expect(row).toBeVisible();
    await expect(row).toContainText(/running/i);

    // It eventually completes, and the bell spinner clears.
    await expect(row).toContainText(/completed/i, { timeout: 20_000 });
    await expect(notifications.bellSpinner).toBeHidden();

    // Cleanup — household-shared, so delete the record this test created.
    await aepRemove(adminToken, 'operations', operation.id);
  });
});
