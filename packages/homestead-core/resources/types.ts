/**
 * Shared types for aepbase resource definitions declared in TypeScript.
 *
 * Each app declares the schema for the aepbase collections it owns
 * via `HomeApp.resources`. The shape mirrors what aepbase's
 * `/aep-resource-definitions` endpoint accepts on POST/PATCH — see
 * `packages/homestead-core/resources/sync.ts` for the runner.
 */

export type JsonSchemaPrimitive =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'binary';

export interface JsonSchemaProperty {
  type: JsonSchemaPrimitive;
  description?: string;
  format?: string;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  /**
   * aepbase experimental marker for binary fields backed by uploaded
   * files. Pair with `type: 'binary'`. See
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
   * Lazy import of the handler app. The dispatcher awaits this on demand
   * and invokes the default export.
   */
  load: () => Promise<{ default: CustomMethodHandler }>;
}

export interface ResourceDefinition {
  /** Kebab-case singular form, e.g. `gift-card`. Globally unique. */
  singular: string;
  /** Kebab-case plural form, e.g. `gift-cards`. */
  plural: string;
  description?: string;
  user_settable_create?: boolean;
  /**
   * Singulars of parent resources. The runner topologically sorts by
   * this so parents apply before children. `'user'` is treated as a
   * built-in root (provided by aepbase's EnableUsers).
   */
  parents?: string[];
  schema: ResourceSchema;
  /**
   * AEP-136 custom methods that live on this resource, keyed by their
   * kebab-case verb (e.g. `process-image`). Server-only: stripped from the
   * payload sent to aepbase during schema sync and dispatched by the sidecar
   * gateway instead. See `core/resources/custom-methods/dispatcher.ts`.
   */
  customMethods?: Record<string, ResourceCustomMethod>;
}
