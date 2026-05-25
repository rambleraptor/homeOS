import type {
  JsonSchemaProperty,
  ResourceSchema,
} from '@rambleraptor/homestead-core/resources/types';

export type FieldShape = 'read' | 'create' | 'update';

/**
 * Render a JSON Schema property as a TypeScript type expression.
 *
 * `shape` controls how file fields are typed:
 *  - `read`: `string` (the URL aepbase echoes back)
 *  - `create` / `update`: `string | File` (callers may pass either)
 */
export function propertyToTs(
  prop: JsonSchemaProperty,
  shape: FieldShape,
): string {
  if (prop.type === 'binary') {
    return shape === 'read' ? 'string' : 'string | File';
  }
  switch (prop.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array': {
      const inner = prop.items ? propertyToTs(prop.items, shape) : 'unknown';
      return `${parenthesize(inner)}[]`;
    }
    case 'object': {
      if (!prop.properties) return 'Record<string, unknown>';
      return objectShape(prop.properties, prop.required ?? [], shape);
    }
  }
}

function parenthesize(expr: string): string {
  return /[|&]/.test(expr) ? `(${expr})` : expr;
}

function objectShape(
  properties: Record<string, JsonSchemaProperty>,
  required: string[],
  shape: FieldShape,
): string {
  const requiredSet = new Set(required);
  const lines: string[] = ['{'];
  for (const [name, prop] of Object.entries(properties)) {
    const optional = !requiredSet.has(name);
    const ts = propertyToTs(prop, shape);
    lines.push(`    ${quoteKey(name)}${optional ? '?' : ''}: ${ts};`);
  }
  lines.push('  }');
  return lines.join('\n');
}

function quoteKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

/**
 * Render a resource schema as a TypeScript interface body. The
 * server-managed fields (`id`, `path`, `create_time`, `update_time`)
 * are appended on read shapes only.
 */
export function schemaToInterface(
  schema: ResourceSchema,
  shape: FieldShape,
): string {
  const requiredSet = new Set(shape === 'update' ? [] : schema.required ?? []);
  const lines: string[] = ['{'];
  if (shape === 'read') {
    lines.push('  id: string;');
    lines.push('  path: string;');
    lines.push('  create_time: string;');
    lines.push('  update_time: string;');
  }
  for (const [name, prop] of Object.entries(schema.properties)) {
    const optional = shape === 'update' || !requiredSet.has(name);
    const ts = propertyToTs(prop, shape);
    lines.push(`  ${quoteKey(name)}${optional ? '?' : ''}: ${ts};`);
  }
  lines.push('}');
  return lines.join('\n');
}
