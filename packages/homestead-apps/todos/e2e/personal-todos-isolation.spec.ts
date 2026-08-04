/**
 * Personal todo isolation (engine-enforced privacy).
 *
 * Personal todos live under `/users/{uid}/personal-todos`, so the engine's
 * user-scope check must keep them private: one regular user can neither list
 * nor fetch another's. This is an API-level test — the guarantee is in the
 * engine, not the UI — using two distinct regular users (superusers bypass the
 * scope check, so they can't prove isolation).
 */

import { expect } from '@playwright/test';
import { test } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import { getAepbaseUrl } from '../../../../tests/e2e/config/aepbase.setup';
import {
  createUser,
  deleteIfPresent,
} from '../../../../tests/e2e/utils/aepbase-helpers';
import { createPersonalTodo, listPersonalTodos } from './helpers';

const USER_B_EMAIL = 'user-b-personal@test.local';
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

test.describe('Personal todo isolation', () => {
  let userBId: string | undefined;

  test.afterEach(async ({ adminToken }) => {
    if (userBId) {
      // Force-cascade so the user's own personal todos go with them.
      await deleteIfPresent(adminToken, 'users', userBId, { force: true });
      userBId = undefined;
    }
  });

  test("a user cannot see or fetch another user's personal todos", async ({
    adminToken,
    userToken,
    userId,
  }) => {
    // userA is the fixture's regular user; create userB as a second one.
    const userB = await createUser(adminToken, {
      email: USER_B_EMAIL,
      password: USER_B_PASSWORD,
      display_name: 'User B',
    });
    userBId = userB.id;
    const userBToken = await login(USER_B_EMAIL, USER_B_PASSWORD);

    // userA creates a private todo.
    const todo = await createPersonalTodo(userToken, userId, {
      title: 'A secret',
    });

    // userA sees it under their own path.
    const mine = await listPersonalTodos(userToken, userId);
    expect(mine.map((t) => t.id)).toContain(todo.id);

    // userB's own personal list is unaffected — no leakage across users.
    const theirs = await listPersonalTodos(userBToken, userBId);
    expect(theirs.map((t) => t.title)).not.toContain('A secret');

    // userB cannot list userA's personal todos — the engine 403s cross-user
    // access to a user-parented collection.
    await expect(listPersonalTodos(userBToken, userId)).rejects.toThrow();
  });
});
