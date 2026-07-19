/**
 * Shared types for aepbase resource definitions declared in TypeScript.
 *
 * Each app declares the schema for the aepbase collections it owns
 * via `AppConfig.resources`, using the authoring-friendly `FieldDef`
 * shape. The schema-sync runner translates fields into the JSON-schema
 * wire format aepbase's `/aep-resource-definitions` endpoint accepts —
 * see `packages/homestead-core/resources/translate.ts` for the
 * translation and `sync.ts` for the runner.
 */

import type { BulkImportDef } from './bulk-import/types';

// ----------------------------------------------------------------------------
// Authoring format — what apps write in `resources.ts`
// ----------------------------------------------------------------------------

/**
 * Field types apps may declare. `file` marks an uploaded-file field; the
 * translator turns it into aepbase's `binary` + `x-aepbase-file-field`
 * wire encoding (`binary` itself is not declarable).
 */
export type FieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'file';

/**
 * Chunking / embedding tuning for a file field's `embed`. Pass `embed: true`
 * for the instance defaults, or this object to override them per field.
 */
export interface EmbedOptions {
  /** Approx. characters per chunk before embedding. */
  chunk_size?: number;
  /** Characters of overlap between consecutive chunks. */
  overlap?: number;
  /** Override the instance-wide embedding model for this field. */
  embedding_model?: string;
}

/**
 * AI-driven processing for a `type: 'file'` field. Authoring-side metadata
 * only — stripped from the wire schema; the server reads it from the app
 * registry to drive the behind-the-scenes index pipeline on upload. Both
 * options require a configured AI provider (see `server/ai/config`).
 */
export interface FileAiOptions {
  /**
   * Extract the file's full text (vision/OCR model) into an auto-synthesized
   * companion string field named `<field>_text`. The companion exists only in
   * the wire schema — it is not a writable field apps or the chat model set.
   */
  extract_text?: boolean;
  /**
   * Chunk the extracted text and store vector embeddings so the AI chat can
   * answer semantic questions across records. Implies `extract_text` (you
   * can't embed text you haven't extracted). `true` uses the instance
   * defaults; an object tunes chunking / the embedding model.
   */
  embed?: boolean | EmbedOptions;
}

/**
 * A single field on a resource. Translated to a JSON-schema property
 * (`JsonSchemaProperty`) by `translate.ts` before being sent to aepbase.
 */
export interface FieldDef {
  type: FieldType;
  /**
   * Display name for a single value of this field (e.g. for generated
   * UI labels). Authoring-side metadata only — stripped from the wire
   * schema.
   */
  singular_name?: string;
  /** Display name for multiple values. Stripped from the wire schema. */
  plural_name?: string;
  description?: string;
  /** JSON-schema format hint, e.g. `date-time`. String fields only. */
  format?: string;
  /**
   * Allowed values for a string field. aepbase strips JSON-schema
   * `enum` on round-trip, so the translator encodes the values into the
   * wire description (`one of: a, b`) instead; the chat tool builder
   * passes them to Gemini as a real enum.
   */
  enum?: readonly string[];
  /**
   * Whether the field is required on create. The translator collects
   * `required: true` fields into the JSON-schema `required` array.
   * @default false
   */
  required?: boolean;
  /**
   * Default value applied by the engine when the field is omitted from a
   * create (or full-replace apply) request. Encoded into the wire schema's
   * standard JSON-schema `default` keyword (which aepbase preserves on
   * round-trip, unlike `enum`). Not valid on `file` fields, and must match
   * the field's declared `type`.
   */
  default?: unknown;
  /** Element type for `array` fields. */
  items?: FieldDef;
  /** Nested fields for `object` fields. */
  properties?: Record<string, FieldDef>;
  /**
   * Name of the discriminator property for a tagged-union `object` field.
   * Required whenever `variants` is declared, and vice versa.
   *
   * OpenAPI requires the discriminator property be **defined in, and required
   * by, each variant** — it cannot reference a sibling field. The translator
   * injects it into every variant automatically, so variants must not declare
   * it themselves.
   */
  discriminator?: string;
  /**
   * Tagged-union variants for an `object` field, keyed by discriminator value
   * (kebab-case). Translated to OpenAPI `oneOf` + `discriminator` + `mapping`.
   *
   * Because every variant's fields are flattened into one generated column per
   * distinct field name, a field name used by more than one variant must
   * declare the same `type` in each — the translator fails the build otherwise.
   *
   * @example
   *   metadata: {
   *     type: 'object',
   *     discriminator: 'doc_type',
   *     variants: {
   *       'form-1099-int': { payer_name: { type: 'string' } },
   *       'form-w2':       { employer:   { type: 'string' } },
   *     },
   *   }
   */
  variants?: Record<string, Record<string, FieldDef>>;
  /**
   * AI processing for a `file` field: extract its text and/or embed it for
   * semantic search. Only valid on `type: 'file'`. See {@link FileAiOptions}.
   */
  ai?: FileAiOptions;
}

// ----------------------------------------------------------------------------
// Wire format — what aepbase's /aep-resource-definitions accepts
// ----------------------------------------------------------------------------

export type JsonSchemaPrimitive =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'binary';

/**
 * OpenAPI discriminator object. `propertyName` must name a property that every
 * variant defines and requires; `mapping` points each tag value at the
 * `components.schemas` entry the OpenAPI generator hoists that variant into.
 */
export interface JsonSchemaDiscriminator {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface JsonSchemaProperty {
  type: JsonSchemaPrimitive;
  description?: string;
  format?: string;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  /** Default applied by the engine when the field is omitted on create. */
  default?: unknown;
  /**
   * Allowed values. Only emitted for a variant's discriminator tag, where a
   * single-value enum pins the variant — aepbase strips `enum` from *top-level*
   * properties (hence the `one of: a, b` description encoding), but preserves
   * it inside `oneOf` variants, which is what makes the tag work.
   */
  enum?: readonly string[];
  /** Tagged-union variants. Always paired with {@link discriminator}. */
  oneOf?: JsonSchemaProperty[];
  discriminator?: JsonSchemaDiscriminator;
  /**
   * aepbase experimental marker for binary fields backed by uploaded
   * files. Produced by the translator from `type: 'file'` fields. See
   * `aepbase/main.go` (EnableFileFields).
   */
  'x-aepbase-file-field'?: boolean;
}

export interface ResourceSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

// ----------------------------------------------------------------------------
// Custom methods (AEP-136)
// ----------------------------------------------------------------------------

/**
 * HTTP method a custom method accepts. AEP-136 custom methods are POST by
 * default (they may have side effects); read-only ones may use GET.
 */
export type CustomMethodHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Whether a custom method hangs off the whole collection or a single item.
 *
 * - `collection` → `POST /<plural>:<verb>` (the default). Use for methods
 *   that don't target one existing record, e.g. `grocery-items:process-image`.
 * - `item`       → `POST /<plural>/<id>:<verb>`. The dispatcher exposes the
 *   addressed id on the handler context as `ctx.id`.
 *
 * See https://aep.dev/136/.
 */
export type CustomMethodTarget = 'collection' | 'item';

/**
 * Authenticated caller handed to a custom-method handler. Mirrors the
 * `AuthResult` returned by `core/server/aepbase#authenticate` — kept inline
 * so the resource-contract types stay free of server-only runtime imports.
 *
 * Custom methods always run authenticated, so this is never null.
 */
export interface CustomMethodAuth {
  token: string;
  user: {
    id: string;
    path: string;
    email: string;
    display_name?: string;
    type?: string;
  };
}

/**
 * Context passed to a custom-method handler when the dispatcher invokes it.
 */
export interface CustomMethodContext {
  request: Request;
  /** Authenticated caller — custom methods always require auth. */
  auth: CustomMethodAuth;
  /** Plural of the resource the method lives on, e.g. `grocery-items`. */
  plural: string;
  /** The custom verb being invoked, e.g. `process-image`. */
  verb: string;
  /** `collection` or `item`, matching the method's declared `target`. */
  target: CustomMethodTarget;
  /** Addressed record id — only set for `item`-target methods. */
  id?: string;
  /**
   * Parent chain as alternating `[plural, id, plural, id, ...]` segments
   * when the method lives on a nested resource. Empty for top-level ones.
   */
  parent?: string[];
}

export type CustomMethodHandler = (
  ctx: CustomMethodContext,
) => Promise<Response>;

/**
 * Handler for an **async** (AEP-151) custom method. Unlike a sync handler it
 * doesn't return a `Response`: the dispatcher has already replied `202` with a
 * pending Operation. Instead it runs the real work in the background — the
 * value it resolves to becomes the operation's `response`, and anything it
 * throws becomes the operation's `error`.
 */
export type AsyncCustomMethodHandler = (
  ctx: CustomMethodContext,
) => Promise<unknown>;

/** Either handler shape — resolved from a method's lazy `load()`. */
export type AnyCustomMethodHandler =
  | CustomMethodHandler
  | AsyncCustomMethodHandler;

/**
 * Optional pre-flight check for an **async** method, exported as `validate`
 * alongside the handler.
 *
 * AEP-151: errors that stop the operation from *starting* must surface as
 * ordinary error responses, not as a `202` followed by a failed operation.
 * Return a `Response` to reject the call outright (no operation is created);
 * return nothing to let it proceed. Use it for preconditions and request
 * validation (missing config → 503, bad body → 400).
 */
export type AsyncCustomMethodValidator = (
  ctx: CustomMethodContext,
) => Promise<Response | void>;

/**
 * Declarative definition of a single custom method living on a resource.
 *
 * The handler is referenced via a lazy `import()` so the server-only runtime
 * code stays out of the client bundle when `resources.ts` is loaded by client
 * components (the production build stubs these `methods/*` imports).
 *
 * Custom methods always require an authenticated caller — there is no opt-out.
 *
 * @example
 *   customMethods: {
 *     'process-image': {
 *       target: 'collection',
 *       load: () => import('./methods/process-image'),
 *     },
 *   }
 */
export interface ResourceCustomMethod {
  /** Collection- vs item-scoped. Defaults to `'collection'`. */
  target?: CustomMethodTarget;
  /** HTTP method this custom method accepts. Defaults to `'POST'`. */
  method?: CustomMethodHttpMethod;
  /**
   * When true, this is an AEP-151 **long-running** method: the dispatcher
   * creates an Operation, replies `202` with it immediately, and runs the
   * handler in the background (its resolved value → `response`, a throw →
   * `error`). The handler's default export must be an
   * {@link AsyncCustomMethodHandler}. Defaults to `false` (synchronous).
   */
  async?: boolean;
  /**
   * Human-readable label for the operation this method spawns, shown in the
   * notifications app's Operations tab (e.g. `'Parse receipt'`). Async methods
   * only; defaults to the `plural:verb` method name.
   */
  title?: string;
  /**
   * Lazy import of the handler app. The dispatcher awaits this on demand
   * and invokes the default export — a {@link CustomMethodHandler} for sync
   * methods, or an {@link AsyncCustomMethodHandler} when `async` is true.
   * Async modules may additionally export a {@link AsyncCustomMethodValidator}
   * as `validate` to reject bad calls before an operation is created.
   */
  load: () => Promise<{
    default: AnyCustomMethodHandler;
    validate?: AsyncCustomMethodValidator;
  }>;
}

export interface ResourceDefinition {
  /** Kebab-case singular form, e.g. `gift-card`. Globally unique. */
  singular: string;
  /** Kebab-case plural form, e.g. `gift-cards`. */
  plural: string;
  description?: string;
  user_settable_create?: boolean;
  /**
   * When true, only superusers may create, update, or delete records of
   * this resource; regular users still read within their normal scope
   * (e.g. a user-parented resource stays readable by its owner). Used to
   * lock down `account-tag`, which gates app access and so must not be
   * self-editable. Persisted and enforced by the engine — see
   * `checkSuperuserWrite` in `homestead-server/src/engine/crud.ts`.
   */
  superuser_write?: boolean;
  /**
   * Singulars of parent resources. The runner topologically sorts by
   * this so parents apply before children. `'user'` is treated as a
   * built-in root (provided by aepbase's EnableUsers).
   */
  parents?: string[];
  /**
   * The resource's fields, keyed by snake_case field name. Translated
   * to the JSON-schema wire format (`ResourceSchema`) by the schema
   * sync — apps never write JSON schema directly.
   */
  fields: Record<string, FieldDef>;
  /**
   * AEP-136 custom methods that live on this resource, keyed by their
   * kebab-case verb (e.g. `process-image`). Server-only: stripped from the
   * payload sent to aepbase during schema sync and dispatched by the sidecar
   * gateway instead. See `core/resources/custom-methods/dispatcher.ts`.
   */
  customMethods?: Record<string, ResourceCustomMethod>;
  /**
   * Opt this resource into bulk import. The registry synthesizes a
   * `<plural>:bulk-import` custom method from the declaration, so it needs no
   * entry in `customMethods` and no per-app handler or page. Server-only, and
   * stripped from the schema-sync payload alongside `customMethods`. See
   * `core/resources/bulk-import/types.ts`.
   */
  bulkImport?: BulkImportDef<any>;
}
