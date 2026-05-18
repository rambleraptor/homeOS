/**
 * Account-tag end-to-end coverage.
 *
 * Two layers:
 *
 *  1. Tag CRUD through the Users UI — superuser opens the user form,
 *     adds a tag chip, saves, and the tag round-trips through the
 *     parented `account-tag` resource.
 *
 *  2. Tag-based module gating — a module's `enabled` flag is flipped
 *     to `'tagged'` and `enabled_tags` is set to a single tag. A user
 *     carrying that tag sees the module in the sidebar; an untagged
 *     user does not.
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { UsersPage } from '../../pages/UsersPage';
import { DashboardPage } from '../../pages/DashboardPage';
import {
  aepList,
  createUser,
  deleteUsersExcept,
  createAccountTag,
  listAccountTags,
  setModuleFlag,
  resetModuleFlags,
} from '../../utils/aepbase-helpers';

const uniqueEmail = (tag: string) =>
  `tags-e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

async function loginAs(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /login|sign in/i }).click();
  await page.waitForURL('/dashboard', { timeout: 20000 });
}

test.describe('Account tags: CRUD via the Users UI', () => {
  let usersPage: UsersPage;

  test.beforeEach(async ({ authenticatedAdminPage, adminCreds, testUser, adminToken }) => {
    usersPage = new UsersPage(authenticatedAdminPage);
    await deleteUsersExcept(adminToken, [adminCreds.id, testUser.id]);
    await usersPage.goto();
    await usersPage.expectToBeOnUsersPage();
  });

  test.afterEach(async ({ adminToken, adminCreds, testUser }) => {
    await deleteUsersExcept(adminToken, [adminCreds.id, testUser.id]);
  });

  test('superuser can add tags when creating a user; tags persist as account-tag records', async ({
    adminToken,
  }) => {
    const email = uniqueEmail('create-tagged');

    await usersPage.createUser({
      email,
      displayName: 'Tagged User',
      type: 'regular',
      tags: ['beta', 'kitchen'],
      password: 'password123',
    });

    await usersPage.expectUserInList(email);

    // Backend: verify the parented `account-tag` records exist.
    const users = await aepList<{ id: string; email: string }>(adminToken, 'users');
    const created = users.find((u) => u.email === email);
    expect(created).toBeTruthy();
    if (!created) return;
    const tags = await listAccountTags(adminToken, created.id);
    expect(tags.sort()).toEqual(['beta', 'kitchen']);
  });

  test('superuser can add a tag to an existing user via edit; UI badge appears', async ({
    adminToken,
  }) => {
    const email = uniqueEmail('edit-tagged');
    const created = await createUser(adminToken, {
      email,
      password: 'password123',
      display_name: 'Edit Target',
      type: 'regular',
    });

    await usersPage.goto();
    await usersPage.clickEditUser(created.id);

    await usersPage.fillUserForm({
      email,
      tags: ['beta'],
    });
    await usersPage.submitForm('Save');

    // Modal closes; row shows the tag badge.
    await expect(usersPage['page'].getByTestId('user-email-input')).not.toBeVisible();
    await usersPage.expectUserTag(created.id, 'beta');

    const tags = await listAccountTags(adminToken, created.id);
    expect(tags).toEqual(['beta']);
  });

  test('removing a tag deletes its account-tag record', async ({ adminToken }) => {
    const email = uniqueEmail('remove-tag');
    const created = await createUser(adminToken, {
      email,
      password: 'password123',
      display_name: 'Untag Me',
      type: 'regular',
    });
    await createAccountTag(adminToken, created.id, 'beta');

    await usersPage.goto();
    await usersPage.clickEditUser(created.id);

    // Wait for the chip to appear (form hydrates from server-state).
    const chipRemove = usersPage['page'].getByTestId('user-tags-remove-beta');
    await chipRemove.waitFor({ state: 'visible' });
    await chipRemove.click();
    await usersPage.submitForm('Save');

    await expect(usersPage['page'].getByTestId('user-email-input')).not.toBeVisible();

    const tags = await listAccountTags(adminToken, created.id);
    expect(tags).toEqual([]);
  });
});

test.describe("Account tags: 'tagged' module visibility", () => {
  // We gate the `todos` module — it's a default-`all` module so the
  // baseline test that an untagged user sees it isn't necessary. We
  // flip it to 'tagged' for these specs.
  const GATED_MODULE = 'todos';
  const GATED_MODULE_NAV = /^Todos$/;
  const ALLOWED_TAG = 'beta';

  test.beforeEach(async ({ adminToken, adminCreds, testUser }) => {
    await resetModuleFlags(adminToken);
    await deleteUsersExcept(adminToken, [adminCreds.id, testUser.id]);
  });

  test.afterEach(async ({ adminToken, adminCreds, testUser }) => {
    await resetModuleFlags(adminToken);
    await deleteUsersExcept(adminToken, [adminCreds.id, testUser.id]);
  });

  test('a user with a matching tag sees the gated module in the sidebar', async ({
    page,
    adminToken,
  }) => {
    // Create a tagged regular user.
    const email = uniqueEmail('visible');
    const password = 'password123';
    const user = await createUser(adminToken, {
      email,
      password,
      display_name: 'Tagged Visible',
      type: 'regular',
    });
    await createAccountTag(adminToken, user.id, ALLOWED_TAG);

    // Gate the module.
    await setModuleFlag(adminToken, GATED_MODULE, 'enabled', 'tagged');
    await setModuleFlag(adminToken, GATED_MODULE, 'enabled_tags', ALLOWED_TAG);

    await loginAs(page, email, password);
    // Sidebar should expose the gated module.
    await expect(
      page.getByRole('navigation').getByRole('link', { name: GATED_MODULE_NAV }),
    ).toBeVisible();
  });

  test('a user without the tag does NOT see the gated module', async ({
    page,
    adminToken,
  }) => {
    const email = uniqueEmail('hidden');
    const password = 'password123';
    await createUser(adminToken, {
      email,
      password,
      display_name: 'Untagged',
      type: 'regular',
    });

    await setModuleFlag(adminToken, GATED_MODULE, 'enabled', 'tagged');
    await setModuleFlag(adminToken, GATED_MODULE, 'enabled_tags', ALLOWED_TAG);

    await loginAs(page, email, password);
    await expect(
      page.getByRole('navigation').getByRole('link', { name: GATED_MODULE_NAV }),
    ).toHaveCount(0);
  });

  test('superusers do NOT auto-bypass tag gating', async ({
    page,
    adminToken,
    adminCreds,
  }) => {
    // Gate the module to a tag the bootstrap admin does not have.
    await setModuleFlag(adminToken, GATED_MODULE, 'enabled', 'tagged');
    await setModuleFlag(adminToken, GATED_MODULE, 'enabled_tags', ALLOWED_TAG);

    await loginAs(page, adminCreds.email, adminCreds.password);
    await expect(
      page.getByRole('navigation').getByRole('link', { name: GATED_MODULE_NAV }),
    ).toHaveCount(0);
  });
});
