/**
 * Module-settings schema helpers.
 *
 * Translates the `{ moduleId: { key: ModuleSettingDef } }` declarations
 * collected by `getAllModuleSettingsDefs` into two forms:
 *
 *   1. A flat aepbase record shape — one snake_case field per setting,
 *      namespaced `${moduleId_snake}__${key}` — used when reading or
 *      writing values via the aepbase client.
 *   2. A JSON-schema `properties` object, used by the build-time syncer
 *      that registers the `module-settings` resource definition with
 *      aepbase.
 *
 * aepbase rules we have to work around (see CLAUDE.md § aepbase schema):
 *   - Field names must be snake_case.
 *   - Enum / minimum / maximum are stripped on round-trip, so enum
 *     settings become plain strings with the allowed values encoded in
 *     the `description`.
 */

import type { ModuleSettingDef, ModuleSettingValue } from '../types';

/**
 * Separator between the module id and the setting key in a flattened
 * field name. Double-underscore keeps module-vs-setting boundaries
 * unambiguous even when keys themselves contain underscores.
 */
export const MODULE_SETTING_SEPARATOR = '__';

/**
 * Build the aepbase field name for a `(moduleId, key)` pair.
 *
 *   fieldName('gift-cards', 'show_archived') → 'gift_cards__show_archived'
 */
export function fieldName(moduleId: string, key: string): string {
  return `${moduleId.replace(/-/g, '_')}${MODULE_SETTING_SEPARATOR}${key}`;
}

/**
 * Inverse of `fieldName`. Parses a flat key back into its module id
 * (restored to kebab-case) and setting key. Returns `null` if the key
 * does not carry our separator.
 */
export function parseFieldName(
  flat: string,
): { moduleId: string; key: string } | null {
  const idx = flat.indexOf(MODULE_SETTING_SEPARATOR);
  if (idx <= 0) return null;
  const moduleIdSnake = flat.slice(0, idx);
  const key = flat.slice(idx + MODULE_SETTING_SEPARATOR.length);
  if (!key) return null;
  return { moduleId: moduleIdSnake.replace(/_/g, '-'), key };
}

export type ModuleSettingsDefs = Record<string, Record<string, ModuleSettingDef>>;
export type ModuleSettingsValues = Record<string, Record<string, ModuleSettingValue>>;

/**
 * Merge declared defaults into a `ModuleSettingsValues` tree so every
 * declared setting is guaranteed to have a defined value at the call
 * site.
 */
export function withDefaults(
  defs: ModuleSettingsDefs,
  values: ModuleSettingsValues,
): ModuleSettingsValues {
  const out: ModuleSettingsValues = {};
  for (const [moduleId, moduleDefs] of Object.entries(defs)) {
    const moduleValues: Record<string, ModuleSettingValue> = {
      ...(values[moduleId] ?? {}),
    };
    for (const [key, def] of Object.entries(moduleDefs)) {
      if (moduleValues[key] === undefined && def.default !== undefined) {
        moduleValues[key] = def.default;
      }
    }
    out[moduleId] = moduleValues;
  }
  return out;
}

/**
 * Unflatten an aepbase record (flat field bag) into the nested
 * `{ moduleId: { key: value } }` shape. Unknown fields — including
 * aepbase-managed ones like `id`, `path`, `create_time` — are ignored.
 */
export function unflatten(
  record: Record<string, unknown> | null | undefined,
  defs: ModuleSettingsDefs,
): ModuleSettingsValues {
  const nested: ModuleSettingsValues = {};
  if (!record) return withDefaults(defs, nested);

  for (const [flatKey, rawValue] of Object.entries(record)) {
    const parsed = parseFieldName(flatKey);
    if (!parsed) continue;
    const { moduleId, key } = parsed;
    const def = defs[moduleId]?.[key];
    if (!def) continue;

    const coerced = coerceValue(def, rawValue);
    if (coerced === undefined) continue;
    (nested[moduleId] ??= {})[key] = coerced;
  }

  return withDefaults(defs, nested);
}

function coerceValue(
  def: ModuleSettingDef,
  raw: unknown,
): ModuleSettingValue | undefined {
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
 * JSON-schema property object for a single setting. Enum settings are
 * declared as plain strings with options listed in the description
 * because aepbase strips `enum` on round-trip.
 */
function propertyFor(def: ModuleSettingDef): Record<string, unknown> {
  switch (def.type) {
    case 'string':
      return { type: 'string', description: def.description ?? def.label };
    case 'number':
      return { type: 'number', description: def.description ?? def.label };
    case 'boolean':
      return { type: 'boolean', description: def.description ?? def.label };
    case 'enum': {
      const base = def.description ?? def.label;
      const opts = `one of: ${def.options.join(', ')}`;
      return {
        type: 'string',
        description: base ? `${base} (${opts})` : opts,
      };
    }
  }
}

/**
 * Build the JSON schema for the `module-settings` resource: one
 * flattened property per declared setting, sorted alphabetically so
 * diffs are stable across runs of the syncer.
 */
export function buildResourceSchema(defs: ModuleSettingsDefs): {
  type: 'object';
  properties: Record<string, Record<string, unknown>>;
} {
  const properties: Record<string, Record<string, unknown>> = {};
  const entries: Array<[string, ModuleSettingDef]> = [];
  for (const [moduleId, moduleDefs] of Object.entries(defs)) {
    for (const [key, def] of Object.entries(moduleDefs)) {
      entries.push([fieldName(moduleId, key), def]);
    }
  }
  entries.sort(([a], [b]) => a.localeCompare(b));
  for (const [flat, def] of entries) {
    properties[flat] = propertyFor(def);
  }
  return { type: 'object', properties };
}
