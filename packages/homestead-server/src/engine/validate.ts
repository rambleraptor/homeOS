/** Field validation — port of pkg/resource/validate.go. */

import type { Schema } from './types';
import { STANDARD_FIELDS } from './types';

export function validateRequired(
  schema: Schema,
  fields: Record<string, unknown>,
): string | null {
  return validateRequiredWithFiles(schema, fields, new Set(), new Set());
}

/** Required-field check; file fields count as present when uploaded. */
export function validateRequiredWithFiles(
  schema: Schema,
  fields: Record<string, unknown>,
  fileFields: Set<string>,
  uploaded: Set<string>,
): string | null {
  const missing: string[] = [];
  for (const name of schema.required ?? []) {
    if (STANDARD_FIELDS.has(name)) continue;
    if (fileFields.has(name)) {
      if (!uploaded.has(name)) missing.push(name);
      continue;
    }
    if (!(name in fields)) missing.push(name);
  }
  return missing.length > 0 ? `missing required fields: ${missing.join(', ')}` : null;
}

export function validateTypes(
  schema: Schema,
  fields: Record<string, unknown>,
  skip: Set<string> = new Set(),
): string | null {
  for (const [name, val] of Object.entries(fields)) {
    if (STANDARD_FIELDS.has(name) || skip.has(name)) continue;
    const prop = schema.properties?.[name];
    if (!prop) continue; // unknown fields are ignored (not in schema)
    if (val === null || val === undefined) continue; // null clears any type
    const err = checkType(name, val, prop.type);
    if (err) return err;
  }
  return null;
}

function checkType(name: string, val: unknown, expectedType?: string): string | null {
  switch (expectedType) {
    case 'string':
      if (typeof val !== 'string') return `field "${name}" must be a string`;
      break;
    case 'integer':
      if (typeof val !== 'number' || !Number.isInteger(val)) {
        return `field "${name}" must be an integer`;
      }
      break;
    case 'number':
      if (typeof val !== 'number') return `field "${name}" must be a number`;
      break;
    case 'boolean':
      if (typeof val !== 'boolean') return `field "${name}" must be a boolean`;
      break;
    case 'array':
      if (!Array.isArray(val)) return `field "${name}" must be an array`;
      break;
    case 'object':
      if (typeof val !== 'object' || val === null || Array.isArray(val)) {
        return `field "${name}" must be an object`;
      }
      break;
  }
  return null;
}

/** Enum check: constrained fields must hold one of the allowed strings. */
export function validateEnums(
  enums: Record<string, string[]> | undefined,
  fields: Record<string, unknown>,
): string | null {
  if (!enums || Object.keys(enums).length === 0) return null;
  for (const [name, val] of Object.entries(fields)) {
    if (val === null || val === undefined) continue;
    const allowed = enums[name];
    if (!allowed || allowed.length === 0) continue;
    if (typeof val !== 'string' || !allowed.includes(val)) {
      return `field "${name}" must be one of ${allowed.join(', ')}`;
    }
  }
  return null;
}

/**
 * Fill in schema-declared `default` values for fields absent from a create
 * (or an apply that creates a new resource) payload, in place. Standard,
 * readOnly, and file
 * fields never receive defaults; non-primitive defaults are deep-cloned so
 * records don't share mutable references.
 */
export function applyDefaults(schema: Schema, fields: Record<string, unknown>): void {
  for (const [name, prop] of Object.entries(schema.properties ?? {})) {
    if (prop.default === undefined) continue;
    if (STANDARD_FIELDS.has(name) || prop.readOnly) continue;
    if (prop['x-aepbase-file-field']) continue;
    if (name in fields) continue;
    fields[name] = cloneDefault(prop.default);
  }
}

function cloneDefault(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

/** Remove readOnly-marked fields from a client payload, in place. */
export function stripReadOnlyFields(schema: Schema, fields: Record<string, unknown>): void {
  for (const name of Object.keys(fields)) {
    if (STANDARD_FIELDS.has(name)) continue;
    if (schema.properties?.[name]?.readOnly) {
      delete fields[name];
    }
  }
}
