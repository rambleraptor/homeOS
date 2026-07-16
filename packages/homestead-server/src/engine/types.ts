/**
 * Engine types. Field names follow the wire format (snake_case) so
 * definitions round-trip through JSON and the `_aep_resource_definitions`
 * table without mapping layers — same shapes the Go server used.
 */

/**
 * OpenAPI discriminator object. `propertyName` names the tag property every
 * `oneOf` variant defines and requires.
 */
export interface SchemaDiscriminator {
  propertyName: string;
  mapping?: Record<string, string>;
}

/** OpenAPI-style schema property (subset the engine understands). */
export interface SchemaProperty {
  type?: string; // string | integer | number | boolean | object | array | binary
  format?: string;
  description?: string;
  readOnly?: boolean;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  example?: unknown;
  /** Default applied on create when the field is absent from the body. */
  default?: unknown;
  /** Allowed values. Preserved on `oneOf` variants' discriminator tags. */
  enum?: readonly string[];
  /**
   * Tagged-union variants for an object property. Paired with
   * {@link discriminator}; each variant's fields are projected into derived
   * columns so `filter` can reach them (see `userColumnsFromSchema`).
   */
  oneOf?: SchemaProperty[];
  discriminator?: SchemaDiscriminator;
  [extension: string]: unknown; // x-aepbase-file-field and friends
}

export interface Schema {
  type?: string;
  properties: Record<string, SchemaProperty>;
  required?: string[];
  [extension: string]: unknown;
}

/** A resource definition as stored/served by /aep-resource-definitions. */
export interface ResourceDefinition {
  id?: string;
  path?: string;
  singular: string;
  plural: string;
  description?: string;
  examples?: Record<string, unknown>;
  schema: Schema;
  /** field name -> allowed string values */
  enums?: Record<string, string[]>;
  /** property names holding binary file contents (x-aepbase-file-field) */
  file_fields?: string[];
  parents?: string[];
  singleton?: boolean;
  user_settable_create?: boolean;
  /** Only superusers may create/update/delete records of this resource. */
  superuser_write?: boolean;
  create_time?: string;
  update_time?: string;
}

/** A row of a dynamic resource table. */
export interface StoredResource {
  id: string;
  path: string;
  create_time: string;
  update_time: string;
  fields: Record<string, unknown>;
}

export interface User {
  id: string;
  path: string;
  email: string;
  display_name?: string;
  type: string;
  create_time: string;
  update_time: string;
}

export const TYPE_SUPERUSER = 'superuser';
export const TYPE_REGULAR = 'regular';

/** Columns managed by the engine on every resource table. */
export const STANDARD_FIELDS = new Set(['id', 'path', 'create_time', 'update_time']);
