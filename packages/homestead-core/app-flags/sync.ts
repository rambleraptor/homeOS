/**
 * Push the aggregated app-flags schema to aepbase.
 *
 * Called from `src/instrumentation.ts` when the Next.js server boots,
 * alongside the static resource sync (`syncResourceDefinitions`).
 * Idempotent: on repeat runs it PATCHes the existing resource
 * definition when the schema has drifted.
 *
 * Static resource definitions live in each app's `resources.ts`;
 * this syncer is app-flag-specific because its schema is *derived*
 * from declared flags rather than written out by hand.
 */

import { buildResourceSchema, type AppFlagDefs } from '@rambleraptor/homestead-core/settings/flags';
import { jsonEqual } from '../resources/equal';

const RESOURCE_SINGULAR = 'app-flag';
export const APP_FLAGS = 'app-flags' as const;
const RESOURCE_PLURAL = APP_FLAGS;
const DEFINITIONS_PATH = 'aep-resource-definitions';

interface AepResourceDefinition {
  singular?: string;
  plural?: string;
  description?: string;
  user_settable_create?: boolean;
  parents?: string[];
  schema?: unknown;
}

export interface SyncOptions {
  /** Base URL of the aepbase instance (no trailing slash). */
  aepbaseUrl: string;
  /** Admin bearer token with permission to manage resource definitions. */
  token: string;
  /** Defs from `getAllAppFlagDefs()`. */
  defs: AppFlagDefs;
  /** Optional logger; defaults to console. */
  logger?: Pick<Console, 'info' | 'warn' | 'error'>;
  /**
   * Column names this sync may drop even when they still hold data.
   *
   * The engine refuses a populated column drop by default, so an app removing
   * a flag would otherwise wedge here: the PATCH carries the whole schema
   * and throws before any DDL, so *nothing* in it applies — including fields
   * other apps added in the same boot. One un-droppable column freezes the
   * resource. Filled from migrations that declare a matching `drops` entry
   * against `app-flag`, exactly as the resource sync does.
   */
  authorizedDrops?: ReadonlySet<string>;

}

export interface SyncResult {
  action: 'created' | 'updated' | 'noop';
}

export async function syncAppFlagsSchema(
  options: SyncOptions,
): Promise<SyncResult> {
  const { aepbaseUrl, token, defs, logger = console, authorizedDrops } = options;
  const schema = buildResourceSchema(defs);

  const desired: AepResourceDefinition = {
    singular: RESOURCE_SINGULAR,
    plural: RESOURCE_PLURAL,
    description:
      'Household-wide app flags. Managed by the Next.js server via ' +
      'getAllAppFlagDefs() — schema is generated from declared flags.',
    user_settable_create: true,
    schema,
  };

  const existing = await fetchExisting(aepbaseUrl, token);

  if (!existing) {
    await createDefinition(aepbaseUrl, token, desired);
    logger.info(
      `[app-flags] created resource definition with ${Object.keys(schema.properties).length} field(s)`,
    );
    return { action: 'created' };
  }

  if (jsonEqual(existing.schema, schema)) {
    return { action: 'noop' };
  }

  await patchDefinition(aepbaseUrl, token, { schema }, authorizedDrops);
  logger.info(
    `[app-flags] updated resource definition to ${Object.keys(schema.properties).length} field(s)`,
  );
  return { action: 'updated' };
}

async function fetchExisting(
  aepbaseUrl: string,
  token: string,
): Promise<AepResourceDefinition | null> {
  const res = await fetch(
    `${aepbaseUrl}/${DEFINITIONS_PATH}/${RESOURCE_SINGULAR}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `aepbase GET /${DEFINITIONS_PATH}/${RESOURCE_SINGULAR} → ${res.status}: ${text}`,
    );
  }
  return (await res.json()) as AepResourceDefinition;
}

async function createDefinition(
  aepbaseUrl: string,
  token: string,
  body: AepResourceDefinition,
): Promise<void> {
  const res = await fetch(
    `${aepbaseUrl}/${DEFINITIONS_PATH}?id=${RESOURCE_SINGULAR}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `aepbase POST /${DEFINITIONS_PATH} → ${res.status}: ${text}`,
    );
  }
}

async function patchDefinition(
  aepbaseUrl: string,
  token: string,
  body: Partial<AepResourceDefinition>,
  authorizedDrops?: ReadonlySet<string>,
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/merge-patch+json',
  };
  // Same wire contract as the resource sync: absent means "refuse a populated
  // drop", which is the safe default for a bare PATCH.
  if (authorizedDrops && authorizedDrops.size > 0) {
    headers['X-Homestead-Authorized-Drops'] = [...authorizedDrops].join(',');
  }
  const res = await fetch(
    `${aepbaseUrl}/${DEFINITIONS_PATH}/${RESOURCE_SINGULAR}`,
    { method: 'PATCH', headers, body: JSON.stringify(body) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `aepbase PATCH /${DEFINITIONS_PATH}/${RESOURCE_SINGULAR} → ${res.status}: ${text}`,
    );
  }
}

