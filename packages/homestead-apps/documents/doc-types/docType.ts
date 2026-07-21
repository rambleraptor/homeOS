/**
 * The document-type contract: validate a doc type and compile it into the
 * shapes the rest of the app needs.
 *
 * One TypeScript module (`export default` a {@link DocType}) is the single
 * source of truth for a document type. It drives:
 *   - the resource schema  (`toVariants`  → FieldDef variants → OpenAPI oneOf)
 *   - the AI extraction    (`toZodUnion`  → a Zod union)
 *   - the UI labels        (`DocType.fields[].label`)
 *   - the index-row icon   (`DocType.icon`)
 *
 * The built-in types are a static list (`builtins.ts`), so `validateDocType` is
 * a test-time guard for the invariants the type system can't express
 * (kebab-case id, snake_case fields, the reserved `unknown` id) rather than a
 * boot-time loader.
 */

import { z } from 'zod';
import type {
  CustomMethodAuth,
  FieldDef,
} from '@rambleraptor/homestead-core/resources/types';
import type { LazyIcon } from '@rambleraptor/homestead-core/apps/types';
import type { Document } from '../types';

/**
 * Field types a doc type may declare. `string`/`number` are the scalar leaves
 * the model extracts directly; `array`/`object` compose them so a type can
 * pull a structured value (a list of ingredients, a nested record) in the same
 * classify pass. An `array` must declare `items`, an `object` its `properties`.
 */
export type DocFieldType = 'string' | 'number' | 'array' | 'object';

export interface DocField {
  /** Human-readable name, shown in the UI. */
  label: string;
  type: DocFieldType;
  /** Handed to the model verbatim; the main lever on extraction quality. */
  description?: string;
  /** Element type for an `array` field. Required when `type` is `array`. */
  items?: DocField;
  /** Nested fields for an `object` field. Required when `type` is `object`. */
  properties?: Record<string, DocField>;
}

/**
 * Context handed to a {@link PostClassifyHandler} — the persisted, classified
 * document and the metadata the model extracted for it, plus the caller's auth
 * so the hook can create/read related resources over loopback as that user.
 */
export interface PostClassifyContext {
  /** The document as it stands after classify persisted the match. */
  document: Document;
  /** Extracted fields (nulls stripped), including the `doc_type` discriminator. */
  metadata: Record<string, unknown>;
  /** The classify caller — forward `auth.token` to the aepbase helpers. */
  auth: CustomMethodAuth;
}

export interface PostClassifyResult {
  /**
   * Path of the resource the hook created, e.g. `hsa-receipts/abc`. Stored on
   * the document as `linked_resource`; its presence also guards against a
   * re-run creating a duplicate.
   */
  linked_resource?: string;
}

/**
 * A doc type's post-classify hook: runs server-side after a document matches
 * this type. Returns the created resource's path (recorded on the document) or
 * nothing.
 */
export type PostClassifyHandler = (
  ctx: PostClassifyContext,
) => Promise<PostClassifyResult | void>;

export interface DocType {
  /** Kebab-case, globally unique. Becomes the discriminator value. */
  id: string;
  label: string;
  /** What the document *is* — the model's basis for classifying. */
  description: string;
  /**
   * A lazily-loaded Lucide icon, shown on the index row in place of the
   * "Parsed" badge once a document matches this type. Same shape as an app's
   * `web.icon`, e.g. `() => import('lucide-react').then((m) => m.Landmark)`.
   */
  icon: LazyIcon;
  fields: Record<string, DocField>;
  /**
   * Optional server-only hook run after a document matches this type. Lazily
   * imported (mirrors `ResourceCustomMethod.load`) so its server-only body —
   * aepbase helpers, cross-app imports — stays out of the client bundle. See
   * `methods/classify.ts` for where it fires.
   */
  post_classify?: () => Promise<{ default: PostClassifyHandler }>;
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
 * Validate one doc type object. `source` names the module in errors — an
 * operator's typo should say which file, not just what.
 *
 * The builtins are TypeScript-checked at compile time; this pass exists for the
 * invariants the type system can't express (kebab-case id, snake_case fields,
 * the reserved `unknown` id) and to guard operator-authored overrides, which
 * are dynamically imported and unchecked. Throws rather than skipping: a doc
 * type that silently fails to load looks exactly like one the AI never matches,
 * which is painful to debug.
 */
export function validateDocType(input: unknown, source: string): DocType {
  const fail = (message: string): never => {
    throw new Error(`[documents] invalid doc type "${source}": ${message}`);
  };

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('module must default-export a doc type object');
  }

  const doc = input as Record<string, unknown>;
  const { id, label, description, icon, fields } = doc;

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
  if (typeof icon !== 'function') {
    return fail(
      'icon is required — a lazy Lucide import, e.g. ' +
        '() => import("lucide-react").then((m) => m.FileText)',
    );
  }
  const { post_classify } = doc;
  if (post_classify !== undefined && typeof post_classify !== 'function') {
    return fail('post_classify must be a function (a lazy import of the hook)');
  }

  const parsed = parseFields(fields, '', fail);
  return {
    id,
    label,
    description,
    icon: icon as LazyIcon,
    fields: parsed,
    ...(post_classify ? { post_classify: post_classify as DocType['post_classify'] } : {}),
  };
}

/**
 * Parse and validate a field map, recursing into array `items` and object
 * `properties`. `path` prefixes error messages (empty at the top level).
 */
function parseFields(
  input: unknown,
  path: string,
  fail: (message: string) => never,
): Record<string, DocField> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail(`${path || 'fields'} must be an object`);
  }
  const parsed: Record<string, DocField> = {};
  for (const [name, value] of Object.entries(input as Record<string, unknown>)) {
    const fieldPath = path ? `${path}.${name}` : name;
    if (!SNAKE_RE.test(name)) {
      return fail(`field "${fieldPath}" must be snake_case`);
    }
    parsed[name] = parseField(fieldPath, value, fail);
  }
  if (!Object.keys(parsed).length) {
    return fail(`${path || 'the type'} declares no fields`);
  }
  return parsed;
}

/** Parse and validate one field, recursing into composite `array`/`object` shapes. */
function parseField(
  fieldPath: string,
  value: unknown,
  fail: (message: string) => never,
): DocField {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail(`field "${fieldPath}" must be a mapping`);
  }
  const field = value as Record<string, unknown>;
  if (typeof field.label !== 'string' || !field.label.trim()) {
    return fail(`field "${fieldPath}" needs a label`);
  }
  const type = field.type;
  if (type !== 'string' && type !== 'number' && type !== 'array' && type !== 'object') {
    return fail(
      `field "${fieldPath}" type must be "string", "number", "array", or "object"`,
    );
  }
  if (field.description !== undefined && typeof field.description !== 'string') {
    return fail(`field "${fieldPath}" description must be a string`);
  }
  const out: DocField = {
    label: field.label,
    type,
    ...(field.description ? { description: field.description } : {}),
  };
  if (type === 'array') {
    if (field.items === undefined) {
      return fail(`array field "${fieldPath}" must declare items`);
    }
    out.items = parseField(`${fieldPath}[]`, field.items, fail);
  } else if (field.items !== undefined) {
    return fail(`field "${fieldPath}" declares items but is not an array`);
  }
  if (type === 'object') {
    if (field.properties === undefined) {
      return fail(`object field "${fieldPath}" must declare properties`);
    }
    out.properties = parseFields(field.properties, fieldPath, fail);
  } else if (field.properties !== undefined) {
    return fail(`field "${fieldPath}" declares properties but is not an object`);
  }
  return out;
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
      fields[name] = docFieldToFieldDef(field);
    }
    variants[type.id] = fields;
  }

  // The unmatched case carries no fields — only its tag, which the translator
  // injects. Declared last so it sorts predictably in the emitted schema.
  variants[UNKNOWN_DOC_TYPE] = {};
  return variants;
}

/**
 * One `DocField` → the `FieldDef` the translator turns into wire schema,
 * recursing into array `items` and object `properties`. The type-agreement
 * check in {@link toVariants} guards only the top-level (column) names; nested
 * shapes travel with their parent, so they need no cross-variant reconciliation.
 */
function docFieldToFieldDef(field: DocField): FieldDef {
  const def: FieldDef = {
    type: field.type,
    singular_name: field.label,
    ...(field.description ? { description: field.description } : {}),
  };
  if (field.type === 'array' && field.items) {
    def.items = docFieldToFieldDef(field.items);
  }
  if (field.type === 'object' && field.properties) {
    def.properties = Object.fromEntries(
      Object.entries(field.properties).map(([name, sub]) => [
        name,
        docFieldToFieldDef(sub),
      ]),
    );
  }
  return def;
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
      shape[name] = docFieldToZod(field)
        .nullable()
        .describe(field.description ?? field.label);
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

/**
 * One `DocField` → its Zod *value* schema (the caller adds the outer
 * `.nullable()` for a named field). Recurses for composite shapes:
 *   - `object` → every property nullable-and-described, mirroring the top-level
 *     rule so Gemini emits every key (null when unfound) instead of aborting.
 *   - `array`  → elements are the item schema, left non-nullable — a list holds
 *     values, not null holes; an object element still carries nullable props.
 */
function docFieldToZod(field: DocField): z.ZodTypeAny {
  switch (field.type) {
    case 'number':
      return z.number();
    case 'array':
      // `parseField` guarantees `items` on an array; `!` narrows for the type.
      return z.array(docFieldToZod(field.items!));
    case 'object': {
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [name, sub] of Object.entries(field.properties!)) {
        shape[name] = docFieldToZod(sub)
          .nullable()
          .describe(sub.description ?? sub.label);
      }
      return z.object(shape);
    }
    case 'string':
    default:
      return z.string();
  }
}
