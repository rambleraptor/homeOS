/**
 * Generic aepbase REST helpers for e2e tests.
 *
 * App-specific seed/cleanup helpers (createGiftCard, deleteAllPeople,
 * createGame, …) live next to each feature app under
 * `packages/homestead-apps/<app>/e2e/helpers.ts`. This file only
 * holds the low-level primitives plus a handful of utilities that don't
 * belong to any one app (the household-wide `app-flags` singleton
 * and superuser-only user CRUD).
 */

import { getAepbaseUrl } from '../config/aepbase.setup';

type ParentPath = string[];

interface RequestOptions {
  token: string;
  method?: string;
  body?: unknown;
  mergePatch?: boolean;
  multipart?: FormData;
}

async function req(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
  };
  let body: BodyInit | undefined;
  if (opts.multipart) {
    body = opts.multipart;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = opts.mergePatch
      ? 'application/merge-patch+json'
      : 'application/json';
    body = JSON.stringify(opts.body);
  }
  return fetch(`${getAepbaseUrl()}${path}`, {
    method: opts.method || 'GET',
    headers,
    body,
  });
}

function pathFor(plural: string, parent?: ParentPath): string {
  if (parent && parent.length > 0) return '/' + parent.join('/') + `/${plural}`;
  return `/${plural}`;
}

export async function aepGet<T>(
  token: string,
  plural: string,
  id: string,
  parent?: ParentPath,
): Promise<T> {
  const res = await req(`${pathFor(plural, parent)}/${id}`, { token });
  if (!res.ok) throw new Error(`get ${plural}/${id} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function aepUpdate<T>(
  token: string,
  plural: string,
  id: string,
  body: Record<string, unknown>,
  parent?: ParentPath,
): Promise<T> {
  const res = await req(`${pathFor(plural, parent)}/${id}`, {
    token,
    method: 'PATCH',
    body,
    mergePatch: true,
  });
  if (!res.ok) throw new Error(`update ${plural}/${id} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function aepList<T>(
  token: string,
  plural: string,
  parent?: ParentPath,
): Promise<T[]> {
  const res = await req(`${pathFor(plural, parent)}?max_page_size=200`, { token });
  if (!res.ok) {
    if (res.status === 404 || res.status === 403) return [];
    throw new Error(`list ${plural} failed: ${res.status}`);
  }
  const body = (await res.json()) as { results?: T[] };
  return body.results || [];
}

export async function aepCreate<T>(
  token: string,
  plural: string,
  body: Record<string, unknown>,
  parent?: ParentPath,
): Promise<T> {
  const res = await req(pathFor(plural, parent), { token, method: 'POST', body });
  if (!res.ok) {
    throw new Error(`create ${plural} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function aepCreateMultipart<T>(
  token: string,
  plural: string,
  formData: FormData,
  parent?: ParentPath,
): Promise<T> {
  const res = await req(pathFor(plural, parent), {
    token,
    method: 'POST',
    multipart: formData,
  });
  if (!res.ok) {
    throw new Error(`create ${plural} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/**
 * Invoke an AEP-136/151 custom method, e.g.
 * `postCustomMethod(token, '/documents/abc123:classify')`.
 * Returns the raw Response so callers can assert on status (a 202 carrying an
 * operation for async methods, or a pre-flight rejection).
 */
export async function postCustomMethod(
  token: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  return req(path, { token, method: 'POST', body: body ?? {} });
}

export async function aepRemove(
  token: string,
  plural: string,
  id: string,
  parent?: ParentPath,
  force = false,
): Promise<void> {
  const query = force ? '?force=true' : '';
  const res = await req(`${pathFor(plural, parent)}/${id}${query}`, {
    token,
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`delete ${plural}/${id} failed: ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// App flags (household-wide singleton — not app-specific)
// ---------------------------------------------------------------------------

interface AppFlagsRecord {
  id: string;
  [field: string]: unknown;
}

/** Upsert a single app flag. Mirrors `useUpdateAppFlag.upsertFlag`. */
export async function setAppFlag(
  token: string,
  appId: string,
  key: string,
  value: string | number | boolean,
): Promise<void> {
  const flatField = `${appId.replace(/-/g, '_')}__${key}`;
  const payload = { [flatField]: value };
  const existing = await aepList<AppFlagsRecord>(token, 'app-flags');
  if (existing.length > 0) {
    await aepUpdate<AppFlagsRecord>(
      token,
      'app-flags',
      existing[0].id,
      payload,
    );
    return;
  }
  await aepCreate<AppFlagsRecord>(token, 'app-flags', payload);
}

/** Delete every app-flags singleton record (resets all flags to defaults). */
export async function resetAppFlags(token: string) {
  const records = await aepList<AppFlagsRecord>(token, 'app-flags');
  for (const record of records) {
    await aepRemove(token, 'app-flags', record.id);
  }
}

// ---------------------------------------------------------------------------
// Users (superuser-only — admin CRUD over the user collection)
// ---------------------------------------------------------------------------

interface CreateUserInput {
  email: string;
  password: string;
  display_name?: string;
  type?: 'regular' | 'superuser';
}

export interface UserRecord {
  id: string;
  email: string;
  display_name?: string;
  type?: 'regular' | 'superuser';
}

export async function createUser(
  adminToken: string,
  data: CreateUserInput,
): Promise<UserRecord> {
  return aepCreate<UserRecord>(adminToken, 'users', {
    email: data.email,
    password: data.password,
    display_name: data.display_name || '',
    type: data.type || 'regular',
  });
}

/**
 * Delete every user except the ids in `preserveIds`. Used by Users app
 * tests to tidy up without wiping the bootstrap superuser or the fixture-
 * owned `testUser`.
 */
export async function deleteUsersExcept(
  adminToken: string,
  preserveIds: string[],
) {
  const users = await aepList<{ id: string }>(adminToken, 'users');
  const keep = new Set(preserveIds);
  for (const u of users) {
    if (keep.has(u.id)) continue;
    // Users own child resources (notifications, preferences); force-cascade.
    await aepRemove(adminToken, 'users', u.id, undefined, true);
  }
}

// ---------------------------------------------------------------------------
// Account tags (parented under user — see packages/homestead-core/superuser/users/resources.ts)
// ---------------------------------------------------------------------------

interface AccountTagRecord {
  id: string;
  name: string;
}

/** List a user's account tags via the parented `/users/{id}/account-tags`. */
export async function listAccountTags(
  token: string,
  userId: string,
): Promise<string[]> {
  const records = await aepList<AccountTagRecord>(token, 'account-tags', [
    'users',
    userId,
  ]);
  return records.map((r) => r.name);
}

/** Create a single tag record for a user. */
export async function createAccountTag(
  token: string,
  userId: string,
  name: string,
): Promise<AccountTagRecord> {
  return aepCreate<AccountTagRecord>(
    token,
    'account-tags',
    { name },
    ['users', userId],
  );
}
