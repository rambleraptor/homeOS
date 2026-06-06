import { readFileSync } from 'node:fs';
import type { Resource, Schema } from '@aep_dev/aep-lib-ts';

/** Raw parsed flags, as produced by the CLI's `parseFlags`. */
export type RawFlags = Record<string, string | boolean>;

/** A usage error (bad flag, missing required field). Maps to exit code 1. */
export class FlagError extends Error {}

/** Whole-body flag name (aepcli parity): `--@data file.json`. */
export const DATA_FLAG = '@data';
/** User-settable create id flag. */
export const ID_FLAG = 'id';

export type FieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object';

/** A settable (or file) field derived from a resource's JSON schema. */
export interface FieldFlag {
  name: string;
  type: FieldType;
  description?: string;
  required: boolean;
  /** Binary/file field — set via the app, not the CLI. */
  fileField: boolean;
}

/**
 * Derive the create/update flags from a resource's schema. Server-managed
 * (`readOnly`) properties are skipped. File fields are returned with
 * `fileField: true` so help can flag them, but they aren't settable here.
 */
export function fieldFlags(resource: Resource): FieldFlag[] {
  const props = resource.schema.properties ?? {};
  const required = new Set(resource.schema.required ?? []);
  const out: FieldFlag[] = [];
  for (const [name, prop] of Object.entries(props)) {
    if (prop.readOnly) continue;
    if (name === ID_FLAG) continue; // handled explicitly for create
    out.push({
      name,
      type: fieldType(prop),
      description: prop.description,
      required: required.has(name),
      fileField: isFileField(prop),
    });
  }
  return out;
}

function fieldType(prop: Schema): FieldType {
  switch (prop.type) {
    case 'number':
      return 'number';
    case 'integer':
      return 'integer';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'array';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
}

function isFileField(prop: Schema): boolean {
  const extra = prop as Record<string, unknown>;
  return (
    prop.type === 'binary' ||
    prop.format === 'binary' ||
    prop.format === 'byte' ||
    extra['x-aepbase-file-field'] === true
  );
}

/**
 * Placeholder names for a resource's parents, in pattern order. For
 * `transaction` (`/gift-cards/{gift-card}/transactions/{transaction}`) this is
 * `['gift-card']`; the trailing `{transaction}` is the resource's own id.
 */
export function parentPlaceholders(resource: Resource): string[] {
  const elems = resource.patternElems;
  const out: string[] = [];
  for (let i = 1; i < elems.length - 1; i += 2) {
    out.push(elems[i].slice(1, -1));
  }
  return out;
}

/** Read each parent id from its flag (e.g. `--gift-card <id>`); throw if missing. */
export function collectParentParams(
  resource: Resource,
  flags: RawFlags,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const name of parentPlaceholders(resource)) {
    const value = flags[name];
    if (typeof value !== 'string' || value === '') {
      throw new FlagError(
        `resource "${resource.singular}" is nested — pass its parent id with --${name} <id>`,
      );
    }
    params[name] = value;
  }
  return params;
}

/**
 * Build the full item path (`gift-cards/<cardId>/transactions/<txId>`) for
 * get/update/delete from the resource pattern, parent params, and the item id.
 */
export function buildItemPath(
  resource: Resource,
  parentParams: Record<string, string>,
  id: string,
): string {
  const elems = resource.patternElems;
  const parts: string[] = [];
  for (let i = 0; i < elems.length; i++) {
    if (i % 2 === 0) {
      parts.push(elems[i]);
      continue;
    }
    const isLast = i === elems.length - 1;
    const name = elems[i].slice(1, -1);
    const value = isLast ? id : parentParams[name];
    if (!value) {
      throw new FlagError(`missing id for ${name}`);
    }
    parts.push(value);
  }
  return parts.join('/');
}

export interface BuildBodyOptions {
  /** Enforce required fields + user-settable id (create vs update). */
  forCreate: boolean;
  /** Flag names that are NOT body fields (globals, parents, verbs). */
  reserved: Set<string>;
}

/**
 * Assemble the request body from flags. `--@data file.json` supplies the whole
 * body (mutually exclusive with per-field flags); otherwise each schema field
 * is read from its flag and coerced to the schema's type.
 */
export function buildBody(
  resource: Resource,
  fields: FieldFlag[],
  flags: RawFlags,
  opts: BuildBodyOptions,
): Record<string, unknown> {
  const byName = new Map(fields.map((f) => [f.name, f]));

  const dataValue = flags[DATA_FLAG];
  if (dataValue !== undefined) {
    if (typeof dataValue !== 'string') {
      throw new FlagError('--@data needs a path to a JSON file');
    }
    if (fields.some((f) => f.name in flags)) {
      throw new FlagError('--@data cannot be combined with per-field flags');
    }
    const body = readJsonFile(dataValue);
    return finalizeCreateId(resource, body, flags, opts);
  }

  const body: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(flags)) {
    if (opts.reserved.has(key)) continue;
    const field = byName.get(key);
    if (!field) {
      throw new FlagError(`unknown flag --${key} for "${resource.singular}"`);
    }
    if (field.fileField) {
      throw new FlagError(
        `--${key} is a file field; set it in the app, not the CLI`,
      );
    }
    body[key] = coerce(field, raw);
  }

  if (opts.forCreate) {
    const missing = fields
      .filter((f) => f.required && !f.fileField && !(f.name in body))
      .map((f) => `--${f.name}`);
    if (missing.length > 0) {
      throw new FlagError(`missing required field(s): ${missing.join(', ')}`);
    }
  }

  return finalizeCreateId(resource, body, flags, opts);
}

/**
 * For user-settable-create resources, fold the `--id` flag into the body
 * (aep-lib-ts's Client reads `body.id` for the `?id=` suffix).
 */
function finalizeCreateId(
  resource: Resource,
  body: Record<string, unknown>,
  flags: RawFlags,
  opts: BuildBodyOptions,
): Record<string, unknown> {
  if (!opts.forCreate || !resource.createMethod?.supportsUserSettableCreate) {
    return body;
  }
  const idFlag = flags[ID_FLAG];
  if (typeof idFlag === 'string' && idFlag !== '') {
    return { ...body, id: idFlag };
  }
  if (typeof body.id === 'string' && body.id !== '') {
    return body;
  }
  throw new FlagError(
    `"${resource.singular}" needs a client-supplied id — pass --id <id>`,
  );
}

function coerce(field: FieldFlag, raw: string | boolean): unknown {
  if (field.type === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    throw new FlagError(`--${field.name} expects true or false`);
  }
  if (typeof raw !== 'string') {
    throw new FlagError(`--${field.name} expects a value`);
  }
  switch (field.type) {
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new FlagError(`--${field.name} must be a number`);
      return n;
    }
    case 'integer': {
      const n = Number(raw);
      if (!Number.isInteger(n)) throw new FlagError(`--${field.name} must be an integer`);
      return n;
    }
    case 'array':
      return raw.split(',').map((s) => s.trim()).filter((s) => s !== '');
    case 'object':
      try {
        return JSON.parse(raw);
      } catch {
        throw new FlagError(`--${field.name} must be valid JSON`);
      }
    default:
      return raw;
  }
}

function readJsonFile(path: string): Record<string, unknown> {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new FlagError(`cannot read --@data file: ${path}`);
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new FlagError(`--@data file is not a JSON object: ${path}`);
  }
}
