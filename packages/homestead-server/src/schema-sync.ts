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

import type { Database } from './engine/sqlite';
import { syncResourceDefinitions } from '@rambleraptor/homestead-core/resources/sync';
import { BUILTIN_RESOURCE_DEFS } from '@rambleraptor/homestead-core/resources/builtins';
import { PERMISSION_RESOURCE_DEFS } from '@rambleraptor/homestead-core/permissions/resources';
import { seedPermissions } from '@rambleraptor/homestead-core/permissions/seed';
import { syncAppFlagsSchema } from '@rambleraptor/homestead-core/app-flags/sync';
import { syncUserSettingsSchema } from '@rambleraptor/homestead-core/user-settings/sync';
import { sweepStaleOperations } from '@rambleraptor/homestead-core/server/operations';
import {
  getAllAppFlagDefs,
  getAllMigrations,
  getAllResourceDefs,
  getAllUserSettingDefs,
} from './app-registry';
import { mintAdminToken } from './bootstrap';
import { runMigrations } from './migrations';

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
    let resourcesSynced = false;
    try {
      const defs = [
        ...BUILTIN_RESOURCE_DEFS,
        ...PERMISSION_RESOURCE_DEFS,
        ...getAllResourceDefs(),
      ];
      const result = await syncResourceDefinitions({ aepbaseUrl, token, defs });
      if (!result.created.length && !result.updated.length) {
        console.info(
          `[resources] schema already in sync (${result.unchanged.length} definitions)`,
        );
      }
      resourcesSynced = true;
    } catch (error) {
      console.error('[resources] schema sync failed', error);
    }

    // Run data migrations once the collections they target exist. Skipped if
    // the resource sync failed — migrating against a half-applied schema would
    // only record spurious failures. The runner is idempotent (a succeeded
    // migration is remembered), so a later boot retries anything still pending.
    if (resourcesSynced) {
      try {
        await runMigrations(db, { token, migrations: getAllMigrations() });
      } catch (error) {
        console.error('[migrations] migration pass failed', error);
      }
    }

    // Seed the permissions baseline (roles + open grant) once the definitions
    // exist. Idempotent: seeds each collection only when empty (§8).
    try {
      const seeded = await seedPermissions(aepbaseUrl, token);
      if (seeded.rolesSeeded || seeded.openGrantSeeded) {
        console.info(
          `[permissions] seeded ${seeded.rolesSeeded} role(s)` +
            `${seeded.openGrantSeeded ? ' + open-household grant' : ''}`,
        );
      }
    } catch (error) {
      console.error('[permissions] baseline seed failed', error);
    }

    // Fail operations orphaned by a restart (must run after the `operations`
    // table exists, i.e. after the resource sync above).
    try {
      const swept = await sweepStaleOperations({ aepbaseUrl, token });
      if (swept > 0) {
        console.info(`[operations] marked ${swept} interrupted operation(s) as failed`);
      }
    } catch (error) {
      console.error('[operations] stale-operation sweep failed', error);
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
