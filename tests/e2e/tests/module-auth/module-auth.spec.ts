/**
 * Backend module authorization E2E tests.
 *
 * Asserts that the Go middleware installed by `aepbase/main.go`
 * blocks REST requests to module-owned collections when the
 * household-wide `${moduleId}__enabled` flag denies the caller.
 *
 * Hits aepbase directly (not the Next.js proxy) because that's where
 * the middleware sits and these tests are about its behavior.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { getAepbaseUrl } from '../../config/aepbase.setup';
import { resetModuleFlags, setModuleFlag } from '../../utils/aepbase-helpers';

const GIFT_CARDS_PLURAL = 'gift-cards';

async function listGiftCards(token: string): Promise<Response> {
  return fetch(`${getAepbaseUrl()}/${GIFT_CARDS_PLURAL}?max_page_size=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

test.describe('module authorization middleware', () => {
  test.beforeEach(async ({ adminToken }) => {
    await resetModuleFlags(adminToken);
  });

  test.afterEach(async ({ adminToken }) => {
    await resetModuleFlags(adminToken);
  });

  test('default (no flag set) lets every signed-in user reach the collection', async ({
    userToken,
    adminToken,
  }) => {
    const userRes = await listGiftCards(userToken);
    expect(userRes.status).toBe(200);
    const adminRes = await listGiftCards(adminToken);
    expect(adminRes.status).toBe(200);
  });

  test("'none' blocks everyone, including superusers", async ({
    adminToken,
    userToken,
  }) => {
    await setModuleFlag(adminToken, 'gift-cards', 'enabled', 'none');

    const userRes = await listGiftCards(userToken);
    expect(userRes.status).toBe(403);
    const adminRes = await listGiftCards(adminToken);
    expect(adminRes.status).toBe(403);

    const body = (await userRes.json()) as { error: { message: string } };
    expect(body.error.message).toContain('gift-cards');
  });

  test("'superusers' lets superusers in but blocks regular users", async ({
    adminToken,
    userToken,
  }) => {
    await setModuleFlag(adminToken, 'gift-cards', 'enabled', 'superusers');

    const userRes = await listGiftCards(userToken);
    expect(userRes.status).toBe(403);
    const adminRes = await listGiftCards(adminToken);
    expect(adminRes.status).toBe(200);
  });

  test("'all' restores access for everyone", async ({
    adminToken,
    userToken,
  }) => {
    await setModuleFlag(adminToken, 'gift-cards', 'enabled', 'none');
    expect((await listGiftCards(userToken)).status).toBe(403);

    await setModuleFlag(adminToken, 'gift-cards', 'enabled', 'all');
    expect((await listGiftCards(userToken)).status).toBe(200);
  });

  test('does not gate non-module endpoints (users, module-flags) even when something is disabled', async ({
    adminToken,
    userToken,
  }) => {
    await setModuleFlag(adminToken, 'gift-cards', 'enabled', 'none');

    // The user can still fetch their own profile (built-in `users` collection).
    const meRes = await fetch(`${getAepbaseUrl()}/users`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(meRes.status).toBe(200);

    // And module-flags itself must stay readable so the settings UI works.
    const flagsRes = await fetch(`${getAepbaseUrl()}/module-flags`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(flagsRes.status).toBe(200);
  });

  test('still returns 401 for unauthenticated requests instead of leaking 403', async () => {
    const res = await fetch(`${getAepbaseUrl()}/${GIFT_CARDS_PLURAL}`, {});
    expect(res.status).toBe(401);
  });
});
