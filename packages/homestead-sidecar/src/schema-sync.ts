/**
 * Apply app-declared schema to aepbase on sidecar boot.
 *
 * Ports the old Next `instrumentation.ts#register`: log in as the admin,
 * then push resource definitions, the aggregated app-flags schema, and
 * the user-settings schema. Idempotent — creates what's missing, patches
 * drift, no-ops when in sync.
 *
 * Requires `AEPBASE_ADMIN_EMAIL` / `AEPBASE_ADMIN_PASSWORD`; without them
 * the sync is skipped with a warning (the app still serves — declared
 * defaults show until a collection write 404s on an unregistered def).
 *
 * Relies on the app registry already being initialized (see
 * `./app-registry`, imported for its side effect by `server.ts`).
 */

import {
  getAllResourceDefs,
  getAllAppFlagDefs,
  getAllUserSettingDefs,
} from '@rambleraptor/homestead-core/apps/registry';
import { syncResourceDefinitions } from '@rambleraptor/homestead-core/resources/sync';
import { BUILTIN_RESOURCE_DEFS } from '@rambleraptor/homestead-core/resources/builtins';
import { syncAppFlagsSchema } from '@rambleraptor/homestead-core/app-flags/sync';
import { syncUserSettingsSchema } from '@rambleraptor/homestead-core/user-settings/sync';

export async function syncSchema(): Promise<void> {
  const email = process.env.AEPBASE_ADMIN_EMAIL;
  const password = process.env.AEPBASE_ADMIN_PASSWORD;
  const aepbaseUrl =
    process.env.AEPBASE_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8090';

  if (!email || !password) {
    console.warn(
      '[aepbase-sync] skipping schema sync — AEPBASE_ADMIN_EMAIL / AEPBASE_ADMIN_PASSWORD not set',
    );
    return;
  }

  let token: string;
  try {
    token = await login(aepbaseUrl, email, password);
  } catch (error) {
    console.error('[aepbase-sync] login failed', error);
    return;
  }

  await syncResources(aepbaseUrl, token);
  await syncAppFlags(aepbaseUrl, token);
  await syncUserSettings(aepbaseUrl, token);
}

async function syncResources(aepbaseUrl: string, token: string): Promise<void> {
  try {
    const defs = [...BUILTIN_RESOURCE_DEFS, ...getAllResourceDefs()];
    const result = await syncResourceDefinitions({ aepbaseUrl, token, defs });
    if (!result.created.length && !result.updated.length) {
      console.info(
        `[resources] schema already in sync (${result.unchanged.length} definitions)`,
      );
    }
  } catch (error) {
    console.error('[resources] schema sync failed', error);
  }
}

async function syncAppFlags(
  aepbaseUrl: string,
  token: string,
): Promise<void> {
  try {
    const defs = getAllAppFlagDefs();
    const result = await syncAppFlagsSchema({ aepbaseUrl, token, defs });
    if (result.action === 'noop') {
      console.info('[app-flags] schema already in sync');
    }
  } catch (error) {
    console.error('[app-flags] schema sync failed', error);
  }
}

async function syncUserSettings(
  aepbaseUrl: string,
  token: string,
): Promise<void> {
  try {
    const defs = getAllUserSettingDefs();
    const result = await syncUserSettingsSchema({ aepbaseUrl, token, defs });
    if (result.action === 'noop') {
      console.info('[user-settings] schema already in sync');
    }
  } catch (error) {
    console.error('[user-settings] schema sync failed', error);
  }
}

async function login(
  aepbaseUrl: string,
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${aepbaseUrl}/users/:login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`aepbase login → ${res.status}: ${text}`);
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) {
    throw new Error('aepbase login response missing token');
  }
  return body.token;
}
