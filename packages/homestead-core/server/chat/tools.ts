/**
 * Tool generation for the chat app.
 *
 * Maps every registered aepbase resource definition to four tools —
 * create/read/update/delete — so the model can operate on the user's data.
 * Pure: no registry or network access; callers pass the definition list (the
 * same `BUILTIN_RESOURCE_DEFS` + `getAllResourceDefs()` union the schema sync
 * applies). Tool input schemas are expressed as Zod schemas, which the Vercel
 * AI SDK translates to whichever provider is configured — so this stays
 * provider-agnostic. The matching execution metadata is returned as `bindings`;
 * `handler.ts` attaches the per-request `execute` closures.
 */

import { z } from 'zod';
import type { FieldDef, ResourceDefinition } from '../../resources/types';
import { logger } from '../../utils/logger';

export type CrudOp = 'create' | 'read' | 'update' | 'delete';

/** Everything the executor needs to turn a model tool call into an aepbase request. */
export interface ToolBinding {
  op: CrudOp;
  def: ResourceDefinition;
  /** Ancestor singulars, root first — e.g. `['gift-card']` for transaction. */
  parentChain: string[];
  /** Plural for each `parentChain` entry, same order. */
  parentPlurals: string[];
  /** Tool params that map to schema fields (excludes `id` and parent ids). */
  bodyFields: Set<string>;
  /**
   * Schema fields declared as free-form objects, taken as a JSON-encoded
   * string and JSON-parsed by the executor before hitting aepbase. (Originally
   * a Gemini constraint — empty OBJECT schemas were rejected — now kept for
   * uniform behavior across providers and to keep the executor's parse path
   * valid.)
   */
  jsonStringFields: Set<string>;
}

/** A tool's model-facing surface: description + Zod input schema. */
export interface ToolSpec {
  description: string;
  inputSchema: z.ZodTypeAny;
}

export interface BuiltTools {
  tools: Record<string, ToolSpec>;
  bindings: Map<string, ToolBinding>;
}

/** aepbase's built-in root resource (EnableUsers); never declared in code. */
const USER_ROOT = 'user';
const USER_ROOT_PLURAL = 'users';

const snake = (s: string): string => s.replace(/-/g, '_');

/** Apply a description to a Zod schema only when one is present. */
function described<T extends z.ZodTypeAny>(schema: T, description?: string): T {
  return (description ? schema.describe(description) : schema) as T;
}

interface ConvertedProperty {
  schema: z.ZodTypeAny;
  /** True when a free-form object was downgraded to a JSON string. */
  jsonString: boolean;
}

/**
 * Convert one declared field to a Zod schema.
 * Returns null for fields the model can't supply (file fields).
 */
function fieldToZod(prop: FieldDef): ConvertedProperty | null {
  if (prop.type === 'file') return null;

  const description = prop.description;
  switch (prop.type) {
    case 'string': {
      if (prop.enum?.length) {
        return {
          schema: described(z.enum(prop.enum as [string, ...string[]]), description),
          jsonString: false,
        };
      }
      const note =
        prop.format === 'date-time'
          ? `${description ? `${description} ` : ''}(ISO 8601 date-time)`
          : description;
      return { schema: described(z.string(), note), jsonString: false };
    }
    case 'number':
      return { schema: described(z.number(), description), jsonString: false };
    case 'integer':
      return { schema: described(z.number().int(), description), jsonString: false };
    case 'boolean':
      return { schema: described(z.boolean(), description), jsonString: false };
    case 'array': {
      const items = prop.items ? fieldToZod(prop.items) : null;
      if (!items) return null;
      return { schema: described(z.array(items.schema), description), jsonString: false };
    }
    case 'object': {
      const entries = Object.entries(prop.properties ?? {});
      if (entries.length === 0) {
        // Free-form object: take a JSON-encoded string and parse it server-side.
        return {
          schema: described(
            z.string(),
            `${description ? `${description} ` : ''}(a JSON object, encoded as a JSON string)`,
          ),
          jsonString: true,
        };
      }
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [key, value] of entries) {
        const converted = fieldToZod(value);
        if (!converted) continue;
        shape[key] = value.required ? converted.schema : converted.schema.optional();
      }
      return { schema: described(z.object(shape), description), jsonString: false };
    }
    default:
      return null;
  }
}

/**
 * Resolve a definition's ancestor chain (root first) by following
 * `parents[0]` until the built-in `user` root or an undeclared parent.
 */
function resolveParentChain(
  def: ResourceDefinition,
  bySingular: Map<string, ResourceDefinition>,
): string[] {
  if ((def.parents?.length ?? 0) > 1) {
    logger.warn(
      `chat tools: resource "${def.singular}" declares multiple parents; using the first`,
      { singular: def.singular },
    );
  }
  const chain: string[] = [];
  let current = def.parents?.[0];
  while (current) {
    chain.unshift(current);
    if (current === USER_ROOT) break;
    current = bySingular.get(current)?.parents?.[0];
  }
  return chain;
}

/**
 * Build the chat tools + execution bindings for a set of resource
 * definitions: one create/read/update/delete tool each.
 */
export function buildTools(defs: ResourceDefinition[]): BuiltTools {
  const bySingular = new Map(defs.map((d) => [d.singular, d]));
  const pluralOf = (singular: string): string =>
    singular === USER_ROOT
      ? USER_ROOT_PLURAL
      : (bySingular.get(singular)?.plural ?? `${singular}s`);

  const tools: Record<string, ToolSpec> = {};
  const bindings = new Map<string, ToolBinding>();

  for (const def of defs) {
    const parentChain = resolveParentChain(def, bySingular);
    const parentPlurals = parentChain.map(pluralOf);

    // Required id param per ancestor, e.g. gift_card_id for transactions.
    const parentShape: Record<string, z.ZodTypeAny> = {};
    for (const [i, parent] of parentChain.entries()) {
      parentShape[`${snake(parent)}_id`] = z
        .string()
        .describe(`id of the parent ${parentPlurals[i]} record`);
    }

    // Field params, with their required-ness, shared by create/update.
    const fieldSchemas: Record<string, z.ZodTypeAny> = {};
    const bodyFields = new Set<string>();
    const jsonStringFields = new Set<string>();
    for (const [key, prop] of Object.entries(def.fields)) {
      const converted = fieldToZod(prop);
      if (!converted) continue;
      fieldSchemas[key] = converted.schema;
      bodyFields.add(key);
      if (converted.jsonString) jsonStringFields.add(key);
    }
    const requiredFields = new Set(
      Object.entries(def.fields)
        .filter(([key, prop]) => prop.required && bodyFields.has(key))
        .map(([key]) => key),
    );

    // Create requires its required fields; update is a merge patch (all
    // optional). Read carries an optional id (omit to list).
    const createFields: Record<string, z.ZodTypeAny> = {};
    const updateFields: Record<string, z.ZodTypeAny> = {};
    for (const [key, schema] of Object.entries(fieldSchemas)) {
      createFields[key] = requiredFields.has(key) ? schema : schema.optional();
      updateFields[key] = schema.optional();
    }

    const nesting =
      parentChain.length > 0 ? ` Nested under: ${parentPlurals.join(' → ')}.` : '';
    const about = def.description ? ` ${def.description}` : '';
    const idParam = z.string().describe(`id of the ${def.singular} record`);

    const ops: Array<{ op: CrudOp; spec: ToolSpec }> = [
      {
        op: 'create',
        spec: {
          description: `Create a ${def.singular}.${about}${nesting}`,
          inputSchema: z.object({ ...parentShape, ...createFields }),
        },
      },
      {
        op: 'read',
        spec: {
          description: `Read ${def.plural}.${about}${nesting}`,
          inputSchema: z.object({
            ...parentShape,
            id: z
              .string()
              .describe(`id of the ${def.singular} record. Omit to list all records.`)
              .optional(),
          }),
        },
      },
      {
        op: 'update',
        spec: {
          description:
            `Update a ${def.singular}. Only the provided fields change (merge patch).` +
            `${about}${nesting}`,
          inputSchema: z.object({ ...parentShape, id: idParam, ...updateFields }),
        },
      },
      {
        op: 'delete',
        spec: {
          description: `Delete a ${def.singular}. This cannot be undone.${nesting}`,
          inputSchema: z.object({ ...parentShape, id: idParam }),
        },
      },
    ];

    for (const { op, spec } of ops) {
      const name = `${op}_${snake(def.singular)}`;
      tools[name] = spec;
      bindings.set(name, {
        op,
        def,
        parentChain,
        parentPlurals,
        bodyFields,
        jsonStringFields,
      });
    }
  }

  return { tools, bindings };
}

/** Exported for the executor; mirrors the tool-param naming above. */
export function parentIdParam(parentSingular: string): string {
  return `${snake(parentSingular)}_id`;
}
