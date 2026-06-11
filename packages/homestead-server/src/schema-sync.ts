/**
 * Apply app-declared schema to the engine on boot. Idempotent — creates
 * what's missing, patches drift, no-ops when in sync.
 *
 * The old sidecar logged in over HTTP with AEPBASE_ADMIN_EMAIL/PASSWORD from
 * credentials.json; now the server mints a short-lived admin token directly
 * in its own database and revokes it when done — no stored credentials.
 *
 * Relies on the app registry being initialized (importing ../app-registry).
 */

import type { Database } from 'bun:sqlite';
import { syncResourceDefinitions } from '@rambleraptor/homestead-core/resources/sync';
import { BUILTIN_RESOURCE_DEFS } from '@rambleraptor/homestead-core/resources/builtins';
import { syncAppFlagsSchema } from '@rambleraptor/homestead-core/app-flags/sync';
import { syncUserSettingsSchema } from '@rambleraptor/homestead-core/user-settings/sync';
import {
  getAllAppFlagDefs,
  getAllResourceDefs,
  getAllUserSettingDefs,
} from './app-registry';
import { mintAdminToken } from './bootstrap';

export async function syncSchema(db: Database, aepbaseUrl: string): Promise<void> {
  let admin;
  try {
    admin = mintAdminToken(db);
  } catch (error) {
    console.error('[schema-sync] no admin available; skipping sync', error);
    return;
  }

  const token = admin.token;
  try {
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

    try {
      const result = await syncAppFlagsSchema({
        aepbaseUrl,
        token,
        defs: getAllAppFlagDefs() as never,
      });
      if (result.action === 'noop') console.info('[app-flags] schema already in sync');
    } catch (error) {
      console.error('[app-flags] schema sync failed', error);
    }

    try {
      const result = await syncUserSettingsSchema({
        aepbaseUrl,
        token,
        defs: getAllUserSettingDefs() as never,
      });
      if (result.action === 'noop') console.info('[user-settings] schema already in sync');
    } catch (error) {
      console.error('[user-settings] schema sync failed', error);
    }
  } finally {
    admin.revoke();
  }
}
