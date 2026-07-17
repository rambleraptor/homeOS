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
  FieldType,
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
  validateVariants(field, path, fail);
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

/**
 * Validate a tagged-union object field.
 *
 * The type-consistency rule is the load-bearing one: every variant's fields are
 * flattened into one generated column per *distinct field name*, so a name
 * shared across variants must agree on type. OpenAPI permits the mismatch; our
 * storage cannot, so it fails at boot rather than at query time.
 */
function validateVariants(
  field: FieldDef,
  path: string,
  fail: (message: string) => never,
): void {
  if (field.variants && field.type !== 'object') {
    fail(`field "${path}" declares variants but is not an object`);
  }
  if (field.discriminator && !field.variants) {
    fail(`field "${path}" declares a discriminator but no variants`);
  }
  if (!field.variants) return;
  if (!field.discriminator) {
    fail(`field "${path}" declares variants but no discriminator`);
  }

  const tag = field.discriminator;
  if (!SNAKE_RE.test(tag)) {
    fail(`field "${path}" discriminator "${tag}" must be snake_case`);
  }
  if (field.properties) {
    fail(`field "${path}" cannot declare both properties and variants`);
  }
  if (!Object.keys(field.variants).length) {
    fail(`field "${path}" declares variants but the map is empty`);
  }

  // field name -> the type the first variant declaring it used
  const seen = new Map<string, { type: FieldType; variant: string }>();
  for (const [variantId, fields] of Object.entries(field.variants)) {
    if (!KEBAB_RE.test(variantId)) {
      fail(`field "${path}" variant "${variantId}" must be kebab-case`);
    }
    if (tag in fields) {
      fail(
        `field "${path}" variant "${variantId}" must not declare the ` +
          `discriminator "${tag}" — the translator injects it`,
      );
    }
    validateFields(fields, `${path}.${variantId}`, fail);

    for (const [name, sub] of Object.entries(fields)) {
      const prior = seen.get(name);
      if (prior && prior.type !== sub.type) {
        fail(
          `field "${path}" declares "${name}" as ${prior.type} in variant ` +
            `"${prior.variant}" but ${sub.type} in "${variantId}" — variants ` +
            `share one column per field name, so types must agree`,
        );
      }
      if (!prior) seen.set(name, { type: sub.type, variant: variantId });
    }
  }
}

/** `form-1099-int` -> `Form1099Int`; `metadata` -> `Metadata`. */
function pascalCase(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Name of the `components.schemas` entry a variant is hoisted into, e.g.
 * `document` + `metadata` + `form-1099-int` -> `DocumentMetadataForm1099Int`.
 *
 * Namespaced by resource + field so a variant id can never collide with a real
 * resource's schema entry (which is keyed by bare singular).
 */
export function variantSchemaName(
  singular: string,
  field: string,
  variantId: string,
): string {
  return `${pascalCase(singular)}${pascalCase(field)}${pascalCase(variantId)}`;
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

/**
 * Translate a definition's fields into the aepbase wire schema. `singular`
 * namespaces the `components.schemas` entries that tagged-union variants are
 * hoisted into by the OpenAPI generator.
 */
export function toWireSchema(
  fields: Record<string, FieldDef>,
  singular: string,
): ResourceSchema {
  const { properties, required } = toWireProperties(fields, singular);
  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
  };
}

function toWireProperties(
  fields: Record<string, FieldDef>,
  singular: string,
): {
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
} {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];
  for (const [name, field] of Object.entries(fields)) {
    properties[name] = toWireProperty(field, singular, name);
    if (field.required) required.push(name);
  }
  return { properties, required };
}

/**
 * Translate a tagged union into OpenAPI `oneOf` + `discriminator` + `mapping`.
 *
 * Each variant gets the discriminator injected as a required, single-value-enum
 * property — that's what makes the union unambiguous (a payload matches exactly
 * one variant) and is why OpenAPI requires the tag live inside each variant.
 */
function toWireVariants(
  field: FieldDef,
  singular: string,
  fieldName: string,
): Pick<JsonSchemaProperty, 'oneOf' | 'discriminator'> {
  const tag = field.discriminator!;
  const oneOf: JsonSchemaProperty[] = [];
  const mapping: Record<string, string> = {};

  for (const [variantId, fields] of Object.entries(field.variants!)) {
    const { properties, required } = toWireProperties(fields, singular);
    oneOf.push({
      type: 'object',
      properties: {
        [tag]: { type: 'string', enum: [variantId] },
        ...properties,
      },
      required: [tag, ...required],
    });
    mapping[variantId] = `#/components/schemas/${variantSchemaName(
      singular,
      fieldName,
      variantId,
    )}`;
  }

  return { oneOf, discriminator: { propertyName: tag, mapping } };
}

function toWireProperty(
  field: FieldDef,
  singular: string,
  fieldName: string,
): JsonSchemaProperty {
  const description = wireDescription(field);
  const prop: JsonSchemaProperty = {
    type: field.type === 'file' ? 'binary' : field.type,
    ...(description ? { description } : {}),
    ...(field.format ? { format: field.format } : {}),
    ...(field.default !== undefined ? { default: field.default } : {}),
    ...(field.type === 'file' ? { 'x-aepbase-file-field': true } : {}),
  };
  if (field.items) prop.items = toWireProperty(field.items, singular, fieldName);
  if (field.properties) {
    const { properties, required } = toWireProperties(field.properties, singular);
    prop.properties = properties;
    if (required.length) prop.required = required;
  }
  if (field.variants) Object.assign(prop, toWireVariants(field, singular, fieldName));
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
