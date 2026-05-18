/**
 * Push the resource→module mapping into aepbase so the Go
 * middleware can enforce module-level authorization.
 *
 * The resource definition itself (`module-authorization`) is
 * static and shipped via `BUILTIN_RESOURCE_DEFS`. This syncer
 * only manages the one data row — a JSON-encoded array of
 * `{ plural, singular, module_id }` entries — keyed by the
 * fixed id `default`.
 *
 * Called from `frontend/src/instrumentation.ts` on Next.js boot,
 * after the static resource sync has registered the
 * `module-authorization` definition. Idempotent: PUT (Apply) on
 * each boot replaces the row in place.
 */

import { MODULE_AUTHORIZATIONS } from '../resources/builtins';

export const MODULE_AUTHORIZATION_ID = 'default' as const;

export interface MappingEntry {
  /** Kebab-case resource plural, e.g. 'gift-cards'. */
  plural: string;
  /** Kebab-case resource singular, e.g. 'gift-card'. */
  singular: string;
  /** Kebab-case owning module id, e.g. 'gift-cards'. */
  module_id: string;
}

export interface SyncOptions {
  /** Base URL of the aepbase instance (no trailing slash). */
  aepbaseUrl: string;
  /** Admin bearer token. */
  token: string;
  /** Mapping rows derived from `getAllResourceDefsWithModule()`. */
  mappings: MappingEntry[];
  /** Optional logger; defaults to console. */
  logger?: Pick<Console, 'info' | 'warn' | 'error'>;
}

export interface SyncResult {
  action: 'applied';
  count: number;
}

/**
 * Build the JSON payload string from the mapping rows. Sorted by
 * plural so the JSON shape is stable across builds — keeps diffs
 * predictable and lets us cheaply compare strings if we ever want
 * to skip the PUT on no-op.
 */
export function buildMappingJson(mappings: MappingEntry[]): string {
  const sorted = [...mappings].sort((a, b) => a.plural.localeCompare(b.plural));
  return JSON.stringify({ mappings: sorted });
}

export async function syncModuleAuthorization(
  options: SyncOptions,
): Promise<SyncResult> {
  const { aepbaseUrl, token, mappings, logger = console } = options;
  const body = { mapping_json: buildMappingJson(mappings) };

  const res = await fetch(
    `${aepbaseUrl}/${MODULE_AUTHORIZATIONS}/${MODULE_AUTHORIZATION_ID}`,
    {
      method: 'PUT',
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
      `aepbase PUT /${MODULE_AUTHORIZATIONS}/${MODULE_AUTHORIZATION_ID} → ${res.status}: ${text}`,
    );
  }
  logger.info(`[module-auth] mapping pushed (${mappings.length} entries)`);
  return { action: 'applied', count: mappings.length };
}
