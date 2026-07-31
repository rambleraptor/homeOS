/**
 * Backend app-access enforcement (aepbase middleware).
 *
 * Proves enforcement happens server-side, not just in the UI: the aepbase
 * middleware applies the same `enabled` visibility rule as the frontend
 * (`resolveVisibility`) to every REST call against a gated app's
 * collection. We assert raw HTTP status codes rather than UI state.
 *
 * Gates the `todos` app (collection `todos`, default visibility `all`).
 * The middleware caches flags/tags briefly (AEPBASE_ACCESS_CACHE_TTL_MS), so
 * after a flag change we poll until the new status takes effect rather than
 * asserting once. Runs serially (workers: 1) and resets flags around each
 * test, so it can't bleed into the todos app specs.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { getAepbaseUrl } from '../../config/aepbase.setup';
import {
  setAppFlag,
  resetAppFlags,
  createGroup,
  addGroupMember,
} from '../../utils/aepbase-helpers';

const APP_ID = 'todos';
const COLLECTION = 'todos';

/** Raw GET against the gated collection; returns the HTTP status. */
async function listStatus(token: string): Promise<number> {
  const res = await fetch(`${getAepbaseUrl()}/${COLLECTION}?max_page_size=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

/** Poll the collection until it returns `expected`, riding out the cache TTL. */
async function expectStatus(token: string, expected: number): Promise<void> {
  await expect
    .poll(() => listStatus(token), { timeout: 8000, intervals: [150, 300, 500] })
    .toBe(expected);
}

test.describe('Backend app-access enforcement', () => {
  test.beforeEach(async ({ adminToken }) => {
    await resetAppFlags(adminToken);
  });
  test.afterEach(async ({ adminToken }) => {
    await resetAppFlags(adminToken);
  });

  test("'all' (default) lets a regular user read the collection", async ({
    userToken,
  }) => {
    await expectStatus(userToken, 200);
  });

  test("'superusers' blocks regular users but allows superusers", async ({
    adminToken,
    userToken,
  }) => {
    await setAppFlag(adminToken, APP_ID, 'enabled', 'superusers');
    await expectStatus(userToken, 403);
    await expectStatus(adminToken, 200);
  });

  test("'none' blocks everyone, including superusers", async ({
    adminToken,
  }) => {
    await setAppFlag(adminToken, APP_ID, 'enabled', 'none');
    await expectStatus(adminToken, 403);
  });

  test("'tagged' allows only members of an enabled group (§9.2)", async ({
    adminToken,
    userToken,
    userId,
  }) => {
    await setAppFlag(adminToken, APP_ID, 'enabled', 'tagged');
    // enabled_tags now holds group names (the flag key is kept for compat).
    await setAppFlag(adminToken, APP_ID, 'enabled_tags', 'vip');

    // Regular user is in no group yet → denied.
    await expectStatus(userToken, 403);

    // Add them to a group named 'vip' → allowed.
    const group = await createGroup(adminToken, 'vip');
    await addGroupMember(adminToken, group.id, userId);
    await expectStatus(userToken, 200);
  });
});
