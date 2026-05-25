import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  JsonSchemaProperty,
  ResourceDefinition,
} from '@rambleraptor/homestead-core/resources/types';
import { schemaToInterface } from './schema-to-ts';

export interface GenerateOptions {
  defs: ResourceDefinition[];
  outDir: string;
}

interface IndexedDef {
  def: ResourceDefinition;
  className: string;
  typeName: string;
  createTypeName: string;
  updateTypeName: string;
  /** Children keyed by their direct parent singular. */
  children: IndexedDef[];
  /** Direct parent singular, or null for root resources. */
  parent: string | null;
}

const HEADER = `/* eslint-disable */
// AUTO-GENERATED — do not edit.
// Regenerate via \`npm run generate -w @rambleraptor/homestead-aep-client\`
// (frontend prebuild/predev hooks run this automatically).
`;

export async function generate(options: GenerateOptions): Promise<void> {
  const indexed = indexDefs(options.defs);

  const typesSrc = emitTypes(indexed);
  const clientSrc = emitClient(indexed);
  const indexSrc = `export * from './types';\nexport * from './client';\n`;

  await ensureDir(options.outDir);
  await writeFile(`${options.outDir}/types.ts`, HEADER + typesSrc);
  await writeFile(`${options.outDir}/client.ts`, HEADER + clientSrc);
  await writeFile(`${options.outDir}/index.ts`, HEADER + indexSrc);
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  // dirname only used to avoid lint complaining about an unused import
  void dirname;
}

function indexDefs(defs: ResourceDefinition[]): IndexedDef[] {
  const bySingular = new Map<string, IndexedDef>();
  for (const def of defs) {
    const className = `${pascalCase(def.plural)}Collection`;
    bySingular.set(def.singular, {
      def,
      className,
      typeName: pascalCase(def.singular),
      createTypeName: `${pascalCase(def.singular)}Create`,
      updateTypeName: `${pascalCase(def.singular)}Update`,
      children: [],
      parent: (def.parents && def.parents[0]) || null,
    });
  }
  for (const node of bySingular.values()) {
    if (node.parent && bySingular.has(node.parent)) {
      bySingular.get(node.parent)!.children.push(node);
    }
  }
  return [...bySingular.values()];
}

function emitTypes(nodes: IndexedDef[]): string {
  const out: string[] = [];
  for (const node of nodes) {
    out.push(`export interface ${node.typeName} ${schemaToInterface(node.def.schema, 'read')}\n`);
    out.push(`export interface ${node.createTypeName} ${schemaToInterface(node.def.schema, 'create')}\n`);
    out.push(`export interface ${node.updateTypeName} ${schemaToInterface(node.def.schema, 'update')}\n`);
  }
  return out.join('\n');
}

function emitClient(nodes: IndexedDef[]): string {
  const out: string[] = [];
  out.push(
    `import { BaseClient, ResourceCollection, type ClientOptions } from '../runtime';\n`,
  );
  out.push(`import type {\n`);
  for (const node of nodes) {
    out.push(`  ${node.typeName},\n`);
    out.push(`  ${node.createTypeName},\n`);
    out.push(`  ${node.updateTypeName},\n`);
  }
  out.push(`} from './types';\n\n`);

  // Helpers: user-parented children need a `client.users(userId)` accessor
  // because `user` is a builtin aepbase resource (no ResourceDefinition).
  const userChildren = nodes.filter((n) => n.parent === 'user');

  for (const node of nodes) {
    out.push(emitCollectionClass(node));
    out.push('\n');
  }

  if (userChildren.length) {
    out.push(emitUserScope(userChildren));
    out.push('\n');
  }

  out.push(emitClientClass(nodes, userChildren.length > 0));
  return out.join('');
}

function emitCollectionClass(node: IndexedDef): string {
  const childAccessors = node.children
    .filter((c) => c.parent === node.def.singular)
    .map((child) => emitChildAccessor(node, child))
    .join('');
  const fileDownloads = emitFileDownloadHelpers(node);
  return `export class ${node.className} extends ResourceCollection<${node.typeName}, ${node.createTypeName}, ${node.updateTypeName}> {
  constructor(transport: ConstructorParameters<typeof ResourceCollection>[0], parentPath: readonly string[] = []) {
    super(transport, parentPath, ${JSON.stringify(node.def.plural)});
  }
${childAccessors}${fileDownloads}}\n`;
}

function emitChildAccessor(parent: IndexedDef, child: IndexedDef): string {
  return `
  ${camelCase(child.def.plural)}(parentId: string): ${child.className} {
    return new ${child.className}(this.transport, [...this.parentPath, ${JSON.stringify(parent.def.plural)}, parentId]);
  }
`;
}

function emitFileDownloadHelpers(node: IndexedDef): string {
  const fileFields = collectFileFields(node.def.schema.properties);
  if (!fileFields.length) return '';
  return fileFields
    .map(
      (field) => `
  ${camelCase('download_' + field)}(id: string): Promise<Response> {
    return this.customMethodRaw(id, 'download', { field: ${JSON.stringify(field)} });
  }
`,
    )
    .join('');
}

function collectFileFields(
  properties: Record<string, JsonSchemaProperty>,
): string[] {
  return Object.entries(properties)
    .filter(([, prop]) => prop.type === 'binary')
    .map(([name]) => name);
}

function emitUserScope(userChildren: IndexedDef[]): string {
  const accessors = userChildren
    .map(
      (child) => `
  get ${camelCase(child.def.plural)}(): ${child.className} {
    return new ${child.className}(this.transport, ['users', this.userId]);
  }
`,
    )
    .join('');
  return `export class UserScope {
  constructor(
    readonly transport: ConstructorParameters<typeof ResourceCollection>[0],
    readonly userId: string,
  ) {}
${accessors}}\n`;
}

function emitClientClass(
  nodes: IndexedDef[],
  hasUserScope: boolean,
): string {
  const rootNodes = nodes.filter((n) => !n.parent);
  const accessors = rootNodes
    .map(
      (node) => `  readonly ${camelCase(node.def.plural)}: ${node.className};`,
    )
    .join('\n');
  const initializers = rootNodes
    .map(
      (node) =>
        `    this.${camelCase(node.def.plural)} = new ${node.className}(this.transport);`,
    )
    .join('\n');
  const userScope = hasUserScope
    ? `
  users(userId: string): UserScope {
    return new UserScope(this.transport, userId);
  }
`
    : '';
  return `export class HomesteadClient extends BaseClient {
${accessors}

  constructor(opts: ClientOptions) {
    super(opts);
${initializers}
  }
${userScope}}

export function createClient(opts: ClientOptions): HomesteadClient {
  return new HomesteadClient(opts);
}
`;
}

function pascalCase(input: string): string {
  return input
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join('');
}

function camelCase(input: string): string {
  const pc = pascalCase(input);
  return pc[0]!.toLowerCase() + pc.slice(1);
}
