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
import { createLogger } from './log';
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

const log = createLogger('schema-sync');

/**
 * Fold every migration's `drops` into a `resource → {fields}` map the resource
 * sync hands to the engine, so a populated column named by a `drops` entry is
 * allowed to drop while every other populated column is refused.
 */
function collectAuthorizedDrops(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const migration of getAllMigrations()) {
    for (const drop of migration.drops ?? []) {
      const fields = map.get(drop.resource) ?? new Set<string>();
      fields.add(drop.field);
      map.set(drop.resource, fields);
    }
  }
  return map;
}

export async function syncSchema(db: Database, aepbaseUrl: string): Promise<void> {
  let admin;
  try {
    admin = mintAdminToken(db);
  } catch (error) {
    log.error('no admin available; skipping sync', { err: error });
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
      const result = await syncResourceDefinitions({
        aepbaseUrl,
        token,
        defs,
        authorizedDrops: collectAuthorizedDrops(),
      });
      if (!result.created.length && !result.updated.length) {
        log.child('resources').info('schema already in sync', {
          definitions: result.unchanged.length,
        });
      }
      resourcesSynced = true;
    } catch (error) {
      log.child('resources').error('schema sync failed', { err: error });
    }

    // Run data migrations once the collections they target exist. Skipped if
    // the resource sync failed — migrating against a half-applied schema would
    // only record spurious failures. The runner is idempotent (a succeeded
    // migration is remembered), so a later boot retries anything still pending.
    if (resourcesSynced) {
      try {
        await runMigrations(db, { token, migrations: getAllMigrations() });
      } catch (error) {
        log.child('migrations').error('migration pass failed', { err: error });
      }
    }

    // Seed the permissions baseline (roles + role-bearing groups) once the
    // definitions exist. Idempotent: seeds each collection only when empty
    // (§8). No grant is seeded — a household starts closed.
    try {
      const seeded = await seedPermissions(aepbaseUrl, token);
      if (seeded.rolesSeeded || seeded.groupsSeeded) {
        log.child('permissions').info('seeded baseline', {
          roles: seeded.rolesSeeded,
          groups: seeded.groupsSeeded,
        });
      }
    } catch (error) {
      log.child('permissions').error('baseline seed failed', { err: error });
    }

    // Fail operations orphaned by a restart (must run after the `operations`
    // table exists, i.e. after the resource sync above).
    try {
      const swept = await sweepStaleOperations({ aepbaseUrl, token });
      if (swept > 0) {
        log.child('operations').info('marked interrupted operation(s) as failed', {
          count: swept,
        });
      }
    } catch (error) {
      log.child('operations').error('stale-operation sweep failed', { err: error });
    }

    try {
      const result = await syncAppFlagsSchema({
        aepbaseUrl,
        token,
        defs: getAllAppFlagDefs() as never,
      });
      if (result.action === 'noop') log.child('app-flags').info('schema already in sync');
    } catch (error) {
      log.child('app-flags').error('schema sync failed', { err: error });
    }

    try {
      const result = await syncUserSettingsSchema({
        aepbaseUrl,
        token,
        defs: getAllUserSettingDefs() as never,
      });
      if (result.action === 'noop') log.child('user-settings').info('schema already in sync');
    } catch (error) {
      log.child('user-settings').error('schema sync failed', { err: error });
    }
  } finally {
    admin.revoke();
  }
}
