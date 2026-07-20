/**
 * The document-type contract: parse a YAML doc type, validate it, and compile
 * it into the two shapes the rest of the app needs.
 *
 * One YAML file is the single source of truth for a document type. It drives:
 *   - the resource schema  (`toVariants`  → FieldDef variants → OpenAPI oneOf)
 *   - the AI extraction    (`toZodUnion`  → a Zod union)
 *   - the UI labels        (`DocType.fields[].label`)
 *
 * Runtime-agnostic on purpose: no fs, no import.meta.glob. The server reads the
 * files (`loadDocTypes.server.ts`) and the SPA globs them (its boot shim); both
 * hand the raw text here. Mirrors how app discovery splits `server/
 * app-discovery` from the shared helpers in `apps/discovery`.
 */

import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { FieldDef } from '@rambleraptor/homestead-core/resources/types';

/** Field types a doc type may declare — the subset worth extracting from a page. */
export type DocFieldType = 'string' | 'number';

export interface DocField {
  /** Human-readable name, shown in the UI. */
  label: string;
  type: DocFieldType;
  /** Handed to the model verbatim; the main lever on extraction quality. */
  description?: string;
}

export interface DocType {
  /** Kebab-case, globally unique. Becomes the discriminator value. */
  id: string;
  label: string;
  /** What the document *is* — the model's basis for classifying. */
  description: string;
  fields: Record<string, DocField>;
}

/**
 * The discriminator value for a document matching no known type.
 *
 * A real member of the union rather than an absent value, so the model always
 * has a well-formed option to return and `z.discriminatedUnion` stays total.
 * `parse_status` still records the outcome; this only names the shape.
 */
export const UNKNOWN_DOC_TYPE = 'unknown';

/** Kebab-case: doc type ids become discriminator values, which aepbase keys on. */
const KEBAB_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
/** Snake_case: field names become column names. */
const SNAKE_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

/**
 * Parse and validate one doc type. `source` names the file in errors — an
 * operator's YAML typo should say which file, not just what.
 *
 * Throws rather than skipping: a doc type that silently fails to load looks
 * exactly like one the AI never matches, which is painful to debug.
 */
export function parseDocType(text: string, source: string): DocType {
  const fail = (message: string): never => {
    throw new Error(`[documents] invalid doc type "${source}": ${message}`);
  };

  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (err) {
    return fail(`YAML did not parse: ${err instanceof Error ? err.message : err}`);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail('must be a YAML mapping');
  }

  const doc = raw as Record<string, unknown>;
  const { id, label, description, fields } = doc;

  if (typeof id !== 'string' || !KEBAB_RE.test(id)) {
    return fail(`id ${JSON.stringify(id)} must be kebab-case`);
  }
  if (id === UNKNOWN_DOC_TYPE) {
    return fail(`id "${UNKNOWN_DOC_TYPE}" is reserved for unmatched documents`);
  }
  if (typeof label !== 'string' || !label.trim()) return fail('label is required');
  if (typeof description !== 'string' || !description.trim()) {
    return fail('description is required — it is what the model classifies on');
  }
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return fail('fields must be a mapping');
  }

  const parsed: Record<string, DocField> = {};
  for (const [name, value] of Object.entries(fields as Record<string, unknown>)) {
    if (!SNAKE_RE.test(name)) {
      return fail(`field "${name}" must be snake_case`);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return fail(`field "${name}" must be a mapping`);
    }
    const field = value as Record<string, unknown>;
    if (typeof field.label !== 'string' || !field.label.trim()) {
      return fail(`field "${name}" needs a label`);
    }
    if (field.type !== 'string' && field.type !== 'number') {
      return fail(`field "${name}" type must be "string" or "number"`);
    }
    if (field.description !== undefined && typeof field.description !== 'string') {
      return fail(`field "${name}" description must be a string`);
    }
    parsed[name] = {
      label: field.label,
      type: field.type,
      ...(field.description ? { description: field.description } : {}),
    };
  }

  if (!Object.keys(parsed).length) {
    return fail('declares no fields');
  }
  return { id, label, description, fields: parsed };
}

/**
 * Merge package defaults with the operator's doc types: same id → the project's
 * file wins wholesale, matching how an explicit `homestead.config.ts` app entry
 * beats an auto-discovered one. Sorted by id so schema output is deterministic.
 */
export function mergeDocTypes(defaults: DocType[], overrides: DocType[]): DocType[] {
  const byId = new Map(defaults.map((t) => [t.id, t]));
  for (const t of overrides) byId.set(t.id, t);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Doc types → `FieldDef` variants for the `metadata` field.
 *
 * Every variant's fields share one derived column per name, so the translator
 * requires a name used by two doc types to agree on type. That check lives in
 * homestead-core; here we just surface the conflict with the doc-type ids in
 * the message, which is what an operator can actually act on.
 */
export function toVariants(types: DocType[]): Record<string, Record<string, FieldDef>> {
  const seen = new Map<string, { type: DocFieldType; id: string }>();
  const variants: Record<string, Record<string, FieldDef>> = {};

  for (const type of types) {
    const fields: Record<string, FieldDef> = {};
    for (const [name, field] of Object.entries(type.fields)) {
      const prior = seen.get(name);
      if (prior && prior.type !== field.type) {
        throw new Error(
          `[documents] "${name}" is a ${prior.type} in doc type "${prior.id}" but a ` +
            `${field.type} in "${type.id}". Document types share one column per field ` +
            `name, so a shared name must have the same type in every type that uses it — ` +
            `rename one of them.`,
        );
      }
      if (!prior) seen.set(name, { type: field.type, id: type.id });
      fields[name] = {
        type: field.type,
        singular_name: field.label,
        ...(field.description ? { description: field.description } : {}),
      };
    }
    variants[type.id] = fields;
  }

  // The unmatched case carries no fields — only its tag, which the translator
  // injects. Declared last so it sorts predictably in the emitted schema.
  variants[UNKNOWN_DOC_TYPE] = {};
  return variants;
}

/**
 * Doc types → the Zod union the model fills.
 *
 * Every field is `.nullable()`, not `.optional()`: a partial read degrades to
 * null fields rather than failing validation and losing the whole extraction.
 * The distinction matters to Gemini, not just to Zod. An optional field
 * serialises to a property merely *absent* from `required`, and Gemini 2.5
 * Flash's structured-output engine aborts on that — finishReason "OTHER", zero
 * output tokens, every time (even a single optional field triggers it). A
 * nullable field serialises to `nullable: true`, which Gemini honours: it emits
 * every key, using null for the ones it can't find. `classify` strips the nulls
 * before storing. The `doc_type` literal is the one non-nullable key, which
 * keeps the branches distinguishable.
 *
 * Deliberately `z.union`, not `z.discriminatedUnion`: the AI SDK serialises a
 * discriminated union as JSON-Schema `oneOf`, and Gemini's structured-output
 * schema silently drops `oneOf` — taking every field definition with it, so the
 * model classifies but extracts nothing. `z.union` serialises as `anyOf`, which
 * Gemini honours. Validation is unaffected: the `doc_type` literals keep the
 * branches unambiguous.
 */
export function toZodUnion(types: DocType[]) {
  const variant = (type: DocType) => {
    const shape: Record<string, z.ZodTypeAny> = {
      doc_type: z.literal(type.id),
    };
    for (const [name, field] of Object.entries(type.fields)) {
      const base = field.type === 'number' ? z.number() : z.string();
      shape[name] = base.nullable().describe(field.description ?? field.label);
    }
    return z.object(shape);
  };

  const unknown = z.object({
    doc_type: z.literal(UNKNOWN_DOC_TYPE),
  });

  return z.union([
    ...types.map(variant),
    unknown,
  ] as unknown as [z.ZodObject<{ doc_type: z.ZodLiteral<string> }>, z.ZodObject<{ doc_type: z.ZodLiteral<string> }>]);
}
