/**
 * Reading per-user app settings from server-side code.
 *
 * The browser reaches a setting through `useUserSetting`; a cron or a route has
 * no hooks and no signed-in user, but often needs the same answer for *every*
 * household member — "who asked to be reminded the night before pickup?". This
 * is that seam.
 *
 * Values come back as they sit on the wire. A setting is stored as one flattened
 * field on the user's single `user-preference` record (`home__pickup_reminder`),
 * and aepbase strips JSON-schema `default`, so an untouched setting is simply
 * absent — hence {@link readUserFlag}'s explicit fallback rather than a
 * `?? false` at each call site.
 */

import { serverClient } from './client';
import { USERS, USER_PREFERENCES } from '../resources/builtins';
import { fieldName } from '../user-settings/settings';

interface PreferenceRecord {
  id: string;
  [field: string]: unknown;
}

/**
 * The raw stored value of one setting for one user, or `undefined` when the user
 * has never set it (no record at all, or no such field on it).
 */
export async function readUserSetting(
  token: string,
  userId: string,
  appId: string,
  key: string,
): Promise<unknown> {
  const records = await serverClient(token)
    .collection(USERS)
    .record(userId)
    .collection<PreferenceRecord>(USER_PREFERENCES)
    .listAll();
  // One preference record per user by construction; a second would be a bug
  // upstream, and reading the first matches what the client hook does.
  return records.length > 0 ? records[0][fieldName(appId, key)] : undefined;
}

/**
 * A boolean setting for one user, falling back to `fallback` when it is unset or
 * unreadable. Accepts the string forms too — the same coercion the client-side
 * `unflatten` applies, since a boolean can arrive as `'true'` from a hand-edited
 * record or an older writer.
 */
export async function readUserFlag(
  token: string,
  userId: string,
  appId: string,
  key: string,
  fallback = false,
): Promise<boolean> {
  const raw = await readUserSetting(token, userId, appId, key);
  if (raw === true || raw === 'true') return true;
  if (raw === false || raw === 'false') return false;
  return fallback;
}

/**
 * The subset of `userIds` whose boolean setting is on. Reads one record per
 * user — households are small, and there is no cross-user query for a
 * user-parented collection.
 */
export async function usersWithFlag(
  token: string,
  userIds: readonly string[],
  appId: string,
  key: string,
  fallback = false,
): Promise<string[]> {
  const opted: string[] = [];
  for (const userId of userIds) {
    if (await readUserFlag(token, userId, appId, key, fallback)) {
      opted.push(userId);
    }
  }
  return opted;
}
