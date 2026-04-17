/**
 * Build a CEL filter expression from omnibox filter declarations + the
 * plain values the LLM (or fallback parser) emitted.
 *
 * The Omnibox manifest declares filters with a `type` (`text` | `enum` |
 * `boolean` | `dateRange`); the LLM fills in scalar values keyed by the
 * declared `key`. This module is the one place that turns those values
 * into CEL the aepbase list endpoint can evaluate, so individual modules
 * don't each have to hand-roll their own builder.
 *
 * The returned string is suitable for `aepbase.list({ filter })`.
 */

import type {
  OmniboxFilterDecl,
  OmniboxFilterType,
} from '@/shared/omnibox/types';

/** Escape a value for safe embedding inside a CEL string literal. */
function escapeCelString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Escape a user-entered word for embedding in a RE2 regex (CEL `matches()`). */
function escapeRegex(term: string): string {
  return term.replace(/[.^$*+?()[\]{}|\\]/g, '\\$&');
}

function buildText(field: string, value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const terms = value.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return undefined;
  return terms
    .map((t) => `${field}.matches("(?i)${escapeCelString(escapeRegex(t))}")`)
    .join(' && ');
}

function buildEnum(
  field: string,
  value: unknown,
  values?: string[],
): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  if (values && !values.includes(value)) return undefined;
  return `${field} == "${escapeCelString(value)}"`;
}

function buildBoolean(field: string, value: unknown): string | undefined {
  if (typeof value === 'boolean') {
    return `${field} == ${value ? 'true' : 'false'}`;
  }
  if (value === 'true') return `${field} == true`;
  if (value === 'false') return `${field} == false`;
  return undefined;
}

function buildDateRange(field: string, value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { start, end } = value as { start?: unknown; end?: unknown };
  const parts: string[] = [];
  if (typeof start === 'string' && start) {
    parts.push(`${field} >= "${escapeCelString(start)}"`);
  }
  if (typeof end === 'string' && end) {
    parts.push(`${field} <= "${escapeCelString(end)}"`);
  }
  return parts.length > 0 ? parts.join(' && ') : undefined;
}

const builders: Record<
  OmniboxFilterType,
  (field: string, value: unknown, decl: OmniboxFilterDecl) => string | undefined
> = {
  text: (field, value) => buildText(field, value),
  enum: (field, value, decl) => buildEnum(field, value, decl.values),
  boolean: (field, value) => buildBoolean(field, value),
  dateRange: (field, value) => buildDateRange(field, value),
};

/**
 * Build a single CEL expression from a set of declared filters and the
 * values supplied for them. Per-filter clauses are AND-joined.
 *
 * Returns `undefined` when no filter produced a clause — callers should
 * pass that through unchanged so `aepbase.list()` skips the `filter`
 * query param entirely.
 */
export function buildCelFilter(
  decls: OmniboxFilterDecl[],
  values: Record<string, unknown>,
): string | undefined {
  const clauses: string[] = [];
  for (const decl of decls) {
    const raw = values[decl.key];
    if (raw === undefined || raw === null) continue;
    const field = decl.field ?? decl.key;
    const clause = builders[decl.type](field, raw, decl);
    if (clause) clauses.push(clause);
  }
  return clauses.length > 0 ? clauses.join(' && ') : undefined;
}
