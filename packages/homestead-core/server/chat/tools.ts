/**
 * Gemini tool generation for the chat app.
 *
 * Maps every registered aepbase resource definition to four function
 * declarations — create/read/update/delete — so the model can operate
 * on the user's data. Pure: no registry or network access; callers pass
 * the definition list (the same `BUILTIN_RESOURCE_DEFS` +
 * `getAllResourceDefs()` union the schema sync applies).
 */

import { SchemaType } from '@google/generative-ai';
import type { FunctionDeclaration, Schema } from '@google/generative-ai';
import type { FieldDef, ResourceDefinition } from '../../resources/types';
import { logger } from '../../utils/logger';

export type CrudOp = 'create' | 'read' | 'update' | 'delete';

/** Everything the executor needs to turn a Gemini function call into an aepbase request. */
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
   * Schema fields declared as free-form objects. Gemini rejects OBJECT
   * schemas with empty `properties`, so these are declared as STRING and
   * JSON-parsed by the executor before hitting aepbase.
   */
  jsonStringFields: Set<string>;
}

export interface BuiltTools {
  declarations: FunctionDeclaration[];
  bindings: Map<string, ToolBinding>;
}

/** aepbase's built-in root resource (EnableUsers); never declared in code. */
const USER_ROOT = 'user';
const USER_ROOT_PLURAL = 'users';

const snake = (s: string): string => s.replace(/-/g, '_');

interface ConvertedProperty {
  schema: Schema;
  /** True when a free-form object was downgraded to a JSON string. */
  jsonString: boolean;
}

/**
 * Convert one declared field to a Gemini `Schema`.
 * Returns null for fields the model can't supply (file fields).
 */
function convertProperty(prop: FieldDef): ConvertedProperty | null {
  if (prop.type === 'file') return null;

  const description = prop.description;
  switch (prop.type) {
    case 'string':
      return {
        schema: {
          type: SchemaType.STRING,
          ...(description ? { description } : {}),
          ...(prop.enum?.length
            ? { format: 'enum' as const, enum: [...prop.enum] }
            : // Gemini's string schema accepts only the date-time format.
              prop.format === 'date-time'
              ? { format: 'date-time' as const }
              : {}),
        },
        jsonString: false,
      };
    case 'number':
      return {
        schema: { type: SchemaType.NUMBER, ...(description ? { description } : {}) },
        jsonString: false,
      };
    case 'integer':
      return {
        schema: { type: SchemaType.INTEGER, ...(description ? { description } : {}) },
        jsonString: false,
      };
    case 'boolean':
      return {
        schema: { type: SchemaType.BOOLEAN, ...(description ? { description } : {}) },
        jsonString: false,
      };
    case 'array': {
      const items = prop.items ? convertProperty(prop.items) : null;
      if (!items) return null;
      return {
        schema: {
          type: SchemaType.ARRAY,
          items: items.schema,
          ...(description ? { description } : {}),
        },
        jsonString: false,
      };
    }
    case 'object': {
      const entries = Object.entries(prop.properties ?? {});
      if (entries.length === 0) {
        // Gemini rejects OBJECT schemas with empty properties; take the
        // value as a JSON-encoded string and parse it server-side.
        return {
          schema: {
            type: SchemaType.STRING,
            description: `${description ? `${description} ` : ''}(a JSON object, encoded as a JSON string)`,
          },
          jsonString: true,
        };
      }
      const properties: Record<string, Schema> = {};
      for (const [key, value] of entries) {
        const converted = convertProperty(value);
        if (converted) properties[key] = converted.schema;
      }
      const required = entries
        .filter(([key, value]) => value.required && key in properties)
        .map(([key]) => key);
      return {
        schema: {
          type: SchemaType.OBJECT,
          properties,
          ...(description ? { description } : {}),
          ...(required.length ? { required } : {}),
        },
        jsonString: false,
      };
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
 * Build the Gemini function declarations + execution bindings for a set
 * of resource definitions: one create/read/update/delete tool each.
 */
export function buildTools(defs: ResourceDefinition[]): BuiltTools {
  const bySingular = new Map(defs.map((d) => [d.singular, d]));
  const pluralOf = (singular: string): string =>
    singular === USER_ROOT
      ? USER_ROOT_PLURAL
      : (bySingular.get(singular)?.plural ?? `${singular}s`);

  const declarations: FunctionDeclaration[] = [];
  const bindings = new Map<string, ToolBinding>();

  for (const def of defs) {
    const parentChain = resolveParentChain(def, bySingular);
    const parentPlurals = parentChain.map(pluralOf);

    // Required id param per ancestor, e.g. gift_card_id for transactions.
    const parentParams: Record<string, Schema> = {};
    for (const [i, parent] of parentChain.entries()) {
      parentParams[`${snake(parent)}_id`] = {
        type: SchemaType.STRING,
        description: `id of the parent ${parentPlurals[i]} record`,
      };
    }
    const parentParamNames = Object.keys(parentParams);

    const fieldParams: Record<string, Schema> = {};
    const bodyFields = new Set<string>();
    const jsonStringFields = new Set<string>();
    for (const [key, prop] of Object.entries(def.fields)) {
      const converted = convertProperty(prop);
      if (!converted) continue;
      fieldParams[key] = converted.schema;
      bodyFields.add(key);
      if (converted.jsonString) jsonStringFields.add(key);
    }
    const requiredFields = Object.entries(def.fields)
      .filter(([key, prop]) => prop.required && bodyFields.has(key))
      .map(([key]) => key);

    const nesting =
      parentChain.length > 0 ? ` Nested under: ${parentPlurals.join(' → ')}.` : '';
    const about = def.description ? ` ${def.description}` : '';
    const idParam: Schema = {
      type: SchemaType.STRING,
      description: `id of the ${def.singular} record`,
    };

    const ops: Array<{ op: CrudOp; declaration: FunctionDeclaration }> = [
      {
        op: 'create',
        declaration: {
          name: `create_${snake(def.singular)}`,
          description: `Create a ${def.singular}.${about}${nesting}`,
          parameters: {
            type: SchemaType.OBJECT,
            properties: { ...parentParams, ...fieldParams },
            required: [...parentParamNames, ...requiredFields],
          },
        },
      },
      {
        op: 'read',
        declaration: {
          name: `read_${snake(def.singular)}`,
          description: `Read ${def.plural}.${about}${nesting}`,
          parameters: {
            type: SchemaType.OBJECT,
            properties: {
              ...parentParams,
              id: {
                type: SchemaType.STRING,
                description: `id of the ${def.singular} record. Omit to list all records.`,
              },
            },
            required: parentParamNames,
          },
        },
      },
      {
        op: 'update',
        declaration: {
          name: `update_${snake(def.singular)}`,
          description:
            `Update a ${def.singular}. Only the provided fields change (merge patch).` +
            `${about}${nesting}`,
          parameters: {
            type: SchemaType.OBJECT,
            properties: { ...parentParams, id: idParam, ...fieldParams },
            required: [...parentParamNames, 'id'],
          },
        },
      },
      {
        op: 'delete',
        declaration: {
          name: `delete_${snake(def.singular)}`,
          description: `Delete a ${def.singular}. This cannot be undone.${nesting}`,
          parameters: {
            type: SchemaType.OBJECT,
            properties: { ...parentParams, id: idParam },
            required: [...parentParamNames, 'id'],
          },
        },
      },
    ];

    for (const { op, declaration } of ops) {
      declarations.push(declaration);
      bindings.set(declaration.name, {
        op,
        def,
        parentChain,
        parentPlurals,
        bodyFields,
        jsonStringFields,
      });
    }
  }

  return { declarations, bindings };
}

/** Exported for the executor; mirrors the tool-param naming above. */
export function parentIdParam(parentSingular: string): string {
  return `${snake(parentSingular)}_id`;
}
