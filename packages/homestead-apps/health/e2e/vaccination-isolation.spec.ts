/**
 * Vaccination isolation (engine-enforced privacy).
 *
 * The `vaccination` collection declares `access: { model: 'private' }`, so
 * the household role grant covers only a member's own rows (`created_by ==
 * subject.id`, with owner visibility riding on the engine-set `_owner`).
 * One regular user must neither list nor fetch another's health records.
 * This is an API-level test — the guarantee is in the engine, not the UI —
 * using two distinct regular users (superusers bypass scoping, so they
 * can't prove isolation).
 */

import { expect } from '@playwright/test';
import { test } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import { getAepbaseUrl } from '../../../../tests/e2e/config/aepbase.setup';
import {
  createUser,
  deleteIfPresent,
} from '../../../../tests/e2e/utils/aepbase-helpers';
import {
  createVaccination,
  deleteAllVaccinations,
  getVaccination,
  listVaccinations,
} from './helpers';

const USER_B_EMAIL = 'user-b-health@test.local';
const USER_B_PASSWORD = 'Password123!';

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${getAepbaseUrl()}/users/:login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`login failed: ${res.status} ${await res.text()}`);
  }
  return ((await res.json()) as { token: string }).token;
}

test.describe('Vaccination isolation', () => {
  let userBId: string | undefined;

  test.afterEach(async ({ adminToken, userToken }) => {
    await deleteAllVaccinations(userToken);
    if (userBId) {
      await deleteIfPresent(adminToken, 'users', userBId, { force: true });
      userBId = undefined;
    }
  });

  test("a user cannot see or fetch another user's vaccination records", async ({
    adminToken,
    userToken,
  }) => {
    // userA is the fixture's regular user; create userB as a second one.
    const userB = await createUser(adminToken, {
      email: USER_B_EMAIL,
      password: USER_B_PASSWORD,
      display_name: 'User B',
    });
    userBId = userB.id;
    const userBToken = await login(USER_B_EMAIL, USER_B_PASSWORD);

    // userA records a vaccination.
    const record = await createVaccination(userToken, {
      vaccine: 'Confidential Vaccine',
      date_administered: '2026-01-01',
    });

    // userA sees it in their own list.
    const mine = await listVaccinations(userToken);
    expect(mine.map((v) => v.id)).toContain(record.id);

    // userB's list never contains it — the engine scopes the shared
    // collection to the caller's own rows.
    const theirs = await listVaccinations(userBToken);
    expect(theirs.map((v) => v.id)).not.toContain(record.id);
    expect(theirs.map((v) => v.vaccine)).not.toContain('Confidential Vaccine');

    // Nor can userB fetch it directly by id.
    await expect(getVaccination(userBToken, record.id)).rejects.toThrow();
  });
});
