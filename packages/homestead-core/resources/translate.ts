/**
 * Translate the authoring-friendly `FieldDef` map into the JSON-schema
 * wire format aepbase's `/aep-resource-definitions` endpoint accepts,
 * and validate names early so a bad definition fails at boot with a
 * clear error instead of an aepbase 400.
 *
 * Translation rules:
 *   - `type: 'file'`        → `type: 'binary'` + `'x-aepbase-file-field': true`
 *   - per-field `required`  → collected into the schema-level `required` array
 *   - `enum`                → appended to the wire `description` as
 *                             `one of: a, b` (aepbase strips JSON-schema enum)
 *   - `singular_name` / `plural_name` → authoring-only display metadata, stripped
 */

import type {
  FieldDef,
  JsonSchemaProperty,
  ResourceDefinition,
  ResourceSchema,
} from './types';

/** Kebab-case: aepbase rejects URL params with uppercase letters. */
const KEBAB_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
/** Snake_case: the convention for stored field names. */
const SNAKE_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

/**
 * Validate a definition's names and field shapes. Throws with a
 * `[resources]`-prefixed message naming the offending definition.
 */
export function validateResourceDefinition(def: ResourceDefinition): void {
  const fail = (message: string): never => {
    throw new Error(`[resources] invalid definition "${def.singular}": ${message}`);
  };

  if (!KEBAB_RE.test(def.singular)) {
    fail(`singular "${def.singular}" must be kebab-case`);
  }
  if (!KEBAB_RE.test(def.plural)) {
    fail(`plural "${def.plural}" must be kebab-case`);
  }
  for (const parent of def.parents ?? []) {
    if (!KEBAB_RE.test(parent)) {
      fail(`parent "${parent}" must be kebab-case`);
    }
  }
  validateFields(def.fields, '', fail);
}

function validateFields(
  fields: Record<string, FieldDef>,
  path: string,
  fail: (message: string) => never,
): void {
  for (const [name, field] of Object.entries(fields)) {
    const fieldPath = path ? `${path}.${name}` : name;
    if (!SNAKE_RE.test(name)) {
      fail(`field "${fieldPath}" must be snake_case`);
    }
    validateField(field, fieldPath, fail);
  }
}

function validateField(
  field: FieldDef,
  path: string,
  fail: (message: string) => never,
): void {
  if (field.enum && field.type !== 'string') {
    fail(`field "${path}" declares enum but is not a string`);
  }
  if (field.items && field.type !== 'array') {
    fail(`field "${path}" declares items but is not an array`);
  }
  if (field.type === 'array' && !field.items) {
    fail(`array field "${path}" must declare items`);
  }
  if (field.properties && field.type !== 'object') {
    fail(`field "${path}" declares properties but is not an object`);
  }
  if (field.default !== undefined) {
    if (field.type === 'file') {
      fail(`field "${path}" is a file field and cannot declare a default`);
    }
    if (field.enum && !field.enum.includes(field.default as string)) {
      fail(`field "${path}" default must be one of its enum values`);
    }
    const typeErr = checkDefaultType(field.type, field.default);
    if (typeErr) fail(`field "${path}" default ${typeErr}`);
  }
  if (field.properties) validateFields(field.properties, path, fail);
  if (field.items) validateField(field.items, `${path}[]`, fail);
}

/** Verify a declared default matches the field's declared type. */
function checkDefaultType(type: FieldDef['type'], value: unknown): string | null {
  switch (type) {
    case 'string':
      return typeof value === 'string' ? null : 'must be a string';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value)
        ? null
        : 'must be an integer';
    case 'number':
      return typeof value === 'number' ? null : 'must be a number';
    case 'boolean':
      return typeof value === 'boolean' ? null : 'must be a boolean';
    case 'array':
      return Array.isArray(value) ? null : 'must be an array';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? null
        : 'must be an object';
    default:
      return null;
  }
}

/** Translate a definition's fields into the aepbase wire schema. */
export function toWireSchema(
  fields: Record<string, FieldDef>,
): ResourceSchema {
  const { properties, required } = toWireProperties(fields);
  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
  };
}

function toWireProperties(fields: Record<string, FieldDef>): {
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
} {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];
  for (const [name, field] of Object.entries(fields)) {
    properties[name] = toWireProperty(field);
    if (field.required) required.push(name);
  }
  return { properties, required };
}

function toWireProperty(field: FieldDef): JsonSchemaProperty {
  const description = wireDescription(field);
  const prop: JsonSchemaProperty = {
    type: field.type === 'file' ? 'binary' : field.type,
    ...(description ? { description } : {}),
    ...(field.format ? { format: field.format } : {}),
    ...(field.default !== undefined ? { default: field.default } : {}),
    ...(field.type === 'file' ? { 'x-aepbase-file-field': true } : {}),
  };
  if (field.items) prop.items = toWireProperty(field.items);
  if (field.properties) {
    const { properties, required } = toWireProperties(field.properties);
    prop.properties = properties;
    if (required.length) prop.required = required;
  }
  return prop;
}

/**
 * Wire description: the authored description, with enum values appended
 * as `one of: a, b` since aepbase strips JSON-schema `enum` on round-trip.
 */
function wireDescription(field: FieldDef): string | undefined {
  if (!field.enum?.length) return field.description;
  const allowed = `one of: ${field.enum.join(', ')}`;
  return field.description ? `${field.description} (${allowed})` : allowed;
}
