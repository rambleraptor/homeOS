/**
 * Read a resource definition's declared references in one place, so the chat
 * tool builder and the semantic-search tool don't each re-derive the
 * "reference lives on the field, or on an array's items" rule.
 */

import type { ResourceDefinition } from './types';

/** A single reference field on a resource, flattened for consumers. */
export interface FieldReference {
  /** The declaring field name. */
  field: string;
  /** Kebab-case singular of the referenced resource. */
  resource: string;
  /** True when the field is an array of references (annotation on `items`). */
  isArray: boolean;
}

/**
 * Normalize a stored reference value to the target record's bare id.
 *
 * Reference values are stored as a `{plural}/{id}` path (the standard), but the
 * prefix is cosmetic — the id is the last path segment. Consumers that need the
 * bare id (to `aepGet(plural, id)`, compare, or key a map) go through this so
 * they work regardless of whether a value is a full path or a legacy bare id.
 * Empty/non-string values return an empty string.
 */
export function refToId(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const slash = value.lastIndexOf('/');
  return slash === -1 ? value : value.slice(slash + 1);
}

/** Build the standard `{plural}/{id}` reference value from a bare id. */
export function toRef(plural: string, id: string): string {
  return `${plural}/${id}`;
}

/**
 * Every reference declared on a definition's top-level fields — both scalar
 * string references and to-many array-item references. Nested object/variant
 * references are not surfaced here (no consumer needs them yet).
 */
export function referenceFields(def: ResourceDefinition): FieldReference[] {
  const out: FieldReference[] = [];
  for (const [field, def_] of Object.entries(def.fields)) {
    if (def_.reference) {
      out.push({ field, resource: def_.reference.resource, isArray: false });
    } else if (def_.type === 'array' && def_.items?.reference) {
      out.push({ field, resource: def_.items.reference.resource, isArray: true });
    }
  }
  return out;
}
