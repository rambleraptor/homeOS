/**
 * Health record isolation (engine-enforced privacy).
 *
 * Both `vaccine` and its `vaccination` children declare
 * `access: { model: 'private' }`, so the household role grants cover only a
 * member's own rows (`created_by == subject.id`, with owner visibility
 * riding on the engine-set `_owner`). One regular user must neither list
 * nor fetch another's series or doses. This is an API-level test — the
 * guarantee is in the engine, not the UI — using two distinct regular users
 * (superusers bypass scoping, so they can't prove isolation).
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
  createVaccine,
  deleteAllVaccines,
  getVaccine,
  listVaccinations,
  listVaccines,
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

test.describe('Health record isolation', () => {
  let userBId: string | undefined;

  test.afterEach(async ({ adminToken, userToken }) => {
    await deleteAllVaccines(userToken);
    if (userBId) {
      await deleteIfPresent(adminToken, 'users', userBId, { force: true });
      userBId = undefined;
    }
  });

  test("a user cannot see or fetch another user's vaccines or doses", async ({
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

    // userA tracks a vaccine and records a dose under it.
    const vaccine = await createVaccine(userToken, { name: 'Confidential Vaccine' });
    const dose = await createVaccination(userToken, vaccine.id, {
      date_administered: '2026-01-01',
    });

    // userA sees both.
    const mine = await listVaccines(userToken);
    expect(mine.map((v) => v.id)).toContain(vaccine.id);
    const myDoses = await listVaccinations(userToken, vaccine.id);
    expect(myDoses.map((d) => d.id)).toContain(dose.id);

    // userB's list never contains the series — the engine scopes the shared
    // collection to the caller's own rows.
    const theirs = await listVaccines(userBToken);
    expect(theirs.map((v) => v.id)).not.toContain(vaccine.id);
    expect(theirs.map((v) => v.name)).not.toContain('Confidential Vaccine');

    // Nor can userB fetch the series directly by id.
    await expect(getVaccine(userBToken, vaccine.id)).rejects.toThrow();

    // Addressing userA's dose list directly leaks nothing either: the child
    // rows are scoped like any other rows, so the call errors or comes back
    // empty — never with userA's doses.
    const crossDoses = await listVaccinations(userBToken, vaccine.id).catch(() => []);
    expect(crossDoses).toHaveLength(0);
  });
});
