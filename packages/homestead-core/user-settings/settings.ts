/**
 * Per-user setting schema helpers.
 *
 * The user-settings pipeline mirrors the app-flags one: declared
 * `(appId, key)` pairs flatten into snake_case fields on a single
 * aepbase record. The difference is scope — there is one
 * `user-preference` record per user, parented under
 * `/users/{id}/preferences/{id}`, instead of one household-wide
 * singleton.
 *
 * Mechanics duplicated from `packages/homestead-core/settings/flags.ts`
 * so the two pipelines can evolve independently. Keep
 * {@link USER_SETTING_SEPARATOR} in sync with the flag separator —
 * existing code splits flat field names on `__` regardless of source.
 */

import type { UserSettingDef, UserSettingValue } from '@rambleraptor/homestead-core/apps/types';

export const USER_SETTING_SEPARATOR = '__';

export type UserSettingDefs = Record<string, Record<string, UserSettingDef>>;
export type UserSettingValues = Record<
  string,
  Record<string, UserSettingValue>
>;

/**
 * Build the aepbase field name for a `(appId, key)` pair.
 *
 *   fieldName('people', 'map_provider') → 'people__map_provider'
 *   fieldName('gift-cards', 'show_archived') → 'gift_cards__show_archived'
 */
export function fieldName(appId: string, key: string): string {
  return `${appId.replace(/-/g, '_')}${USER_SETTING_SEPARATOR}${key}`;
}

/**
 * Inverse of `fieldName`. Returns `null` if the input does not carry
 * our separator, so callers can ignore aepbase-managed fields like
 * `id` / `create_time`.
 */
export function parseFieldName(
  flat: string,
): { appId: string; key: string } | null {
  const idx = flat.indexOf(USER_SETTING_SEPARATOR);
  if (idx <= 0) return null;
  const appIdSnake = flat.slice(0, idx);
  const key = flat.slice(idx + USER_SETTING_SEPARATOR.length);
  if (!key) return null;
  return { appId: appIdSnake.replace(/_/g, '-'), key };
}

/**
 * Merge declared defaults into a `UserSettingValues` tree so every
 * declared setting is guaranteed to have a defined value at the call
 * site.
 */
export function withDefaults(
  defs: UserSettingDefs,
  values: UserSettingValues,
): UserSettingValues {
  const out: UserSettingValues = {};
  for (const [appId, appDefs] of Object.entries(defs)) {
    const appValues: Record<string, UserSettingValue> = {
      ...(values[appId] ?? {}),
    };
    for (const [key, def] of Object.entries(appDefs)) {
      if (appValues[key] === undefined && def.default !== undefined) {
        appValues[key] = def.default;
      }
    }
    out[appId] = appValues;
  }
  return out;
}

/**
 * Unflatten an aepbase per-user record into the nested
 * `{ appId: { key: value } }` shape, dropping unknown fields and
 * out-of-options enum values.
 */
export function unflatten(
  record: Record<string, unknown> | null | undefined,
  defs: UserSettingDefs,
): UserSettingValues {
  const nested: UserSettingValues = {};
  if (!record) return withDefaults(defs, nested);

  for (const [flatKey, rawValue] of Object.entries(record)) {
    const parsed = parseFieldName(flatKey);
    if (!parsed) continue;
    const { appId, key } = parsed;
    const def = defs[appId]?.[key];
    if (!def) continue;

    const coerced = coerceValue(def, rawValue);
    if (coerced === undefined) continue;
    (nested[appId] ??= {})[key] = coerced;
  }

  return withDefaults(defs, nested);
}

function coerceValue(
  def: UserSettingDef,
  raw: unknown,
): UserSettingValue | undefined {
  if (raw === null || raw === undefined) return undefined;
  switch (def.type) {
    case 'string':
      return typeof raw === 'string' ? raw : String(raw);
    case 'enum': {
      const str = typeof raw === 'string' ? raw : String(raw);
      return def.options.includes(str) ? str : undefined;
    }
    case 'number': {
      if (typeof raw === 'number') return raw;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    case 'boolean':
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return undefined;
  }
}

/**
 * JSON-schema property object for a single setting. aepbase strips
 * `enum` / `default` / `minimum` / `maximum` on round-trip, so the
 * declared default and enum options ride inside `description` using
 * the same marker convention as app flags.
 */
function propertyFor(def: UserSettingDef): Record<string, unknown> {
  const base = def.description ?? def.label;
  const parts: string[] = [];
  if (def.default !== undefined) {
    parts.push(`default: ${String(def.default)}`);
  }
  const description =
    def.type === 'enum'
      ? decorate(base, [...parts, `one of: ${def.options.join(', ')}`])
      : decorate(base, parts);
  const jsonType = def.type === 'enum' ? 'string' : def.type;
  return { type: jsonType, description };
}

function decorate(base: string, parts: string[]): string {
  if (parts.length === 0) return base;
  const suffix = parts.map((p) => `(${p})`).join(' ');
  return base ? `${base} ${suffix}` : suffix;
}

/**
 * Build the per-user-setting fragment of the `user-preference`
 * resource schema: one flattened property per declared setting, sorted
 * alphabetically so diffs are stable across runs of the syncer.
 *
 * Returns just the property map; the syncer merges it with static
 * fields (dashboard widget customization) before applying.
 */
export function buildSchemaProperties(
  defs: UserSettingDefs,
): Record<string, Record<string, unknown>> {
  const properties: Record<string, Record<string, unknown>> = {};
  const entries: Array<[string, UserSettingDef]> = [];
  for (const [appId, appDefs] of Object.entries(defs)) {
    for (const [key, def] of Object.entries(appDefs)) {
      entries.push([fieldName(appId, key), def]);
    }
  }
  entries.sort(([a], [b]) => a.localeCompare(b));
  for (const [flat, def] of entries) {
    properties[flat] = propertyFor(def);
  }
  return properties;
}
