/**
 * Client-side validation derived from a field's schema. These rules mirror the
 * engine's `validateConstraints` exactly, so they are a fail-fast UX layer over
 * an authoritative server check — a form could skip them and still be safe.
 */

import type { FieldDef } from '../../resources/types';
import { fieldLabel, humanize, resolvedWidgetName } from './helpers';
import type { FieldConfig } from './types';

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Build a validator for a single field. Returns the first violation message, or
 * null. `value` is the field's current form-state value.
 */
export function deriveValidator(
  name: string,
  field: FieldDef,
  config?: FieldConfig,
): (value: unknown) => string | null {
  const label = fieldLabel(name, field, config);
  const widget = resolvedWidgetName(field, config);
  const required = config?.required ?? field.required;

  return (value: unknown): string | null => {
    if (isEmpty(value)) {
      return required ? `${label} is required` : null;
    }

    if ((widget === 'number' || widget === 'currency') && typeof value === 'number') {
      if (field.minimum !== undefined && value < field.minimum) {
        return `${label} must be at least ${field.minimum}`;
      }
      if (field.maximum !== undefined && value > field.maximum) {
        return `${label} must be at most ${field.maximum}`;
      }
      if (field.exclusiveMinimum !== undefined && value <= field.exclusiveMinimum) {
        return `${label} must be greater than ${field.exclusiveMinimum}`;
      }
      if (field.exclusiveMaximum !== undefined && value >= field.exclusiveMaximum) {
        return `${label} must be less than ${field.exclusiveMaximum}`;
      }
      if (field.multipleOf !== undefined && field.multipleOf > 0) {
        const ratio = value / field.multipleOf;
        if (Math.abs(ratio - Math.round(ratio)) > 1e-9) {
          return `${label} must be a multiple of ${field.multipleOf}`;
        }
      }
    }

    if (typeof value === 'string') {
      if (field.enum && !field.enum.includes(value)) {
        return `${label} must be one of: ${field.enum.join(', ')}`;
      }
      const len = [...value].length;
      if (field.minLength !== undefined && len < field.minLength) {
        return `${label} must be at least ${field.minLength} characters`;
      }
      if (field.maxLength !== undefined && len > field.maxLength) {
        return `${label} must be at most ${field.maxLength} characters`;
      }
      if (field.pattern !== undefined) {
        try {
          if (!new RegExp(field.pattern).test(value)) return `${label} is not in the expected format`;
        } catch {
          /* an uncompilable pattern is rejected at boot; never blocks here */
        }
      }
    }

    if (Array.isArray(value)) {
      if (field.minItems !== undefined && value.length < field.minItems) {
        return `${label} must have at least ${field.minItems} item(s)`;
      }
      if (field.maxItems !== undefined && value.length > field.maxItems) {
        return `${label} must have at most ${field.maxItems} item(s)`;
      }
      if (field.uniqueItems && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) {
        return `${label} items must be unique`;
      }
    }

    return null;
  };
}

/**
 * Map an engine validation error back onto the offending field(s) so the form
 * can surface it inline. Handles both engine shapes:
 *   - `missing required fields: a, b` — the required check names several fields;
 *   - `field "x" must be …` — a type/enum/constraint check names one.
 * Returns a field→message map (empty when the message names no known field, so
 * the caller can fall back to a form-level error).
 */
export function mapServerError(
  message: string,
  knownFields: Iterable<string>,
): Record<string, string> {
  const known = knownFields instanceof Set ? knownFields : new Set(knownFields);
  const out: Record<string, string> = {};

  const missing = /missing required fields:\s*(.+)$/i.exec(message);
  if (missing) {
    for (const raw of missing[1]!.split(',')) {
      const name = raw.trim();
      if (known.has(name)) out[name] = `${humanize(name)} is required`;
    }
    if (Object.keys(out).length > 0) return out;
  }

  const single = /field "([^"]+)"/.exec(message);
  if (single && known.has(single[1]!)) {
    out[single[1]!] = message;
  }
  return out;
}
