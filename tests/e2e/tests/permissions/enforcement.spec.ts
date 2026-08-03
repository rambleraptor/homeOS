/**
 * End-to-end permission enforcement, against the real server. Enforcement is
 * unconditional, so this runs as part of the default suite (the grant cache is
 * disabled in global-setup, so a create/delete is seen on the next request).
 *
 * This is the "does enforcement break anything?" gate. It drives the real HTTP
 * API — enforcement lives in the engine, not the UI — with three real
 * principals: two regular users (alice, bob) and the bootstrap superuser
 * (admin). It proves three things end-to-end:
 *
 *   1. The seeded open-household grant (`everyone → write → *`) preserves
 *      today's behavior: a regular user still gets full CRUD over a shared
 *      collection. Flipping enforcement on is a no-op for normal use.
 *   2. Deny wins: a collection-scope deny blocks the named user's reads while
 *      everyone else keeps access, and lifting it restores them.
 *   3. Break-glass: the superuser account is never locked out, even by a deny
 *      that targets everyone.
 *
 * Grants are cleaned up after each test so one case can't leak into the next
 * (the grant cache is disabled in this run, so a create/delete is seen on the
 * next request).
 */

import { test, expect } from '../../fixtures/aepbase.fixture';
import { getAepbaseUrl, readAdminCreds } from '../../config/aepbase.setup';
import {
  deleteIfPresent,
  e2eClient,
  listOrEmpty,
  createUser,
  type UserRecord,
} from '../../utils/aepbase-helpers';

const TODOS = 'todos';
const ACCESS_GRANTS = 'access-grants';

interface Todo {
  id: string;
  title: string;
  status: string;
}
interface Grant {
  id: string;
}

/** Log in a freshly-created user and return their bearer token. */
async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${getAepbaseUrl()}/users/:login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${email} failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { token: string }).token;
}

/** Raw GET so a test can assert on the status code (403 vs 200). */
async function getStatus(token: string, path: string): Promise<number> {
  const res = await fetch(`${getAepbaseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

test.describe('permission enforcement', () => {
  let adminToken: string;
  const created: { plural: string; id: string }[] = [];
  const createdUsers: string[] = [];
  const createdGrants: string[] = [];

  test.beforeAll(async () => {
    adminToken = (await readAdminCreds()).token;
  });

  test.afterEach(async () => {
    // Grants first (a deny left in place would break the next test), then rows.
    for (const id of createdGrants.splice(0)) {
      await deleteIfPresent(adminToken, ACCESS_GRANTS, id);
    }
    for (const { plural, id } of created.splice(0)) {
      await deleteIfPresent(adminToken, plural, id);
    }
    for (const id of createdUsers.splice(0)) {
      await deleteIfPresent(adminToken, 'users', id, { force: true });
    }
  });

  async function makeUser(label: string): Promise<{ user: UserRecord; token: string }> {
    const email = `perm-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    const password = 'perm-e2e-password';
    const user = await createUser(adminToken, { email, password, display_name: label });
    createdUsers.push(user.id);
    return { user, token: await login(email, password) };
  }

  async function makeTodo(token: string, title: string): Promise<Todo> {
    const todo = await e2eClient(token).collection<Todo>(TODOS).create({ title, status: 'pending' });
    created.push({ plural: TODOS, id: todo.id });
    return todo;
  }

  test('the open-household grant preserves full CRUD for a regular user', async () => {
    const alice = await makeUser('alice');

    // Create
    const todo = await makeTodo(alice.token, 'buy milk');
    expect(todo.id).toBeTruthy();

    // Read + list
    const fetched = await e2eClient(alice.token).collection<Todo>(TODOS).get(todo.id);
    expect(fetched.title).toBe('buy milk');
    const listed = await listOrEmpty<Todo>(alice.token, TODOS);
    expect(listed.some((t) => t.id === todo.id)).toBe(true);

    // Update
    const updated = await e2eClient(alice.token)
      .collection<Todo>(TODOS)
      .record(todo.id)
      .update({ status: 'completed' });
    expect(updated.status).toBe('completed');

    // Delete
    await deleteIfPresent(alice.token, TODOS, todo.id);
    expect(await getStatus(alice.token, `/${TODOS}/${todo.id}`)).toBe(404);
  });

  test('a collection-scope deny blocks the named user, and lifting it restores access', async () => {
    const alice = await makeUser('alice');
    const bob = await makeUser('bob');

    const todo = await makeTodo(alice.token, 'shared task');

    // Baseline: under the open grant, Bob can read Alice's todo.
    expect(await getStatus(bob.token, `/${TODOS}/${todo.id}`)).toBe(200);

    // Admin denies Bob read on the whole `todo` collection.
    const deny = await e2eClient(adminToken).collection<Grant>(ACCESS_GRANTS).create({
      subject_type: 'user',
      subject_id: bob.user.id,
      target_scope: 'collection',
      resource_type: 'todo',
      capability: 'read',
      effect: 'deny',
    });
    createdGrants.push(deny.id);

    // Deny wins: Bob is blocked (403 on the record, empty list)...
    expect(await getStatus(bob.token, `/${TODOS}/${todo.id}`)).toBe(403);
    expect((await listOrEmpty<Todo>(bob.token, TODOS)).some((t) => t.id === todo.id)).toBe(false);
    // ...while Alice still reads everything.
    expect(await getStatus(alice.token, `/${TODOS}/${todo.id}`)).toBe(200);

    // Lift the deny → Bob reads again.
    await deleteIfPresent(adminToken, ACCESS_GRANTS, deny.id);
    createdGrants.splice(createdGrants.indexOf(deny.id), 1);
    expect(await getStatus(bob.token, `/${TODOS}/${todo.id}`)).toBe(200);
  });

  test('the superuser is never locked out, even by a deny that targets everyone', async () => {
    const alice = await makeUser('alice');
    const todo = await makeTodo(alice.token, 'admin can still see me');

    // Deny *everyone* read on the todo collection.
    const deny = await e2eClient(adminToken).collection<Grant>(ACCESS_GRANTS).create({
      subject_type: 'everyone',
      target_scope: 'collection',
      resource_type: 'todo',
      capability: 'read',
      effect: 'deny',
    });
    createdGrants.push(deny.id);

    // Alice (regular) is blocked; the superuser breaks glass.
    expect(await getStatus(alice.token, `/${TODOS}/${todo.id}`)).toBe(403);
    expect(await getStatus(adminToken, `/${TODOS}/${todo.id}`)).toBe(200);
    expect((await listOrEmpty<Todo>(adminToken, TODOS)).some((t) => t.id === todo.id)).toBe(true);
  });
});
