import type { Resource } from '@aep_dev/aep-lib-ts';
import { fieldFlags, parentPlaceholders, type FieldFlag } from './resources-flags.ts';

export type Verb = 'list' | 'get' | 'create' | 'update' | 'delete';

/** The CRUD/List verbs a resource actually supports, in display order. */
export function supportedVerbs(resource: Resource): Verb[] {
  const verbs: Verb[] = [];
  if (resource.listMethod) verbs.push('list');
  if (resource.getMethod) verbs.push('get');
  if (resource.createMethod) verbs.push('create');
  if (resource.updateMethod) verbs.push('update');
  if (resource.deleteMethod) verbs.push('delete');
  return verbs;
}

/** The `homestead resources` index: every resource and its verbs. */
export function renderIndex(resources: Record<string, Resource>): string {
  const entries = Object.values(resources).sort((a, b) =>
    a.singular.localeCompare(b.singular),
  );
  const width = Math.max(...entries.map((r) => r.singular.length), 8);
  const lines = [
    'Available resources — run `homestead resources <resource> <verb>`:',
    '',
  ];
  for (const r of entries) {
    const verbs = supportedVerbs(r).join(', ') || '(none)';
    const parents = parentPlaceholders(r);
    const suffix =
      parents.length > 0 ? `   (parent: ${parents.map((p) => `--${p}`).join(' ')})` : '';
    lines.push(`  ${r.singular.padEnd(width)}  ${verbs}${suffix}`);
  }
  lines.push('', 'Run `homestead resources <resource>` for fields and usage.');
  return lines.join('\n');
}

/** Per-resource help: usage lines, fields, and parent flags. */
export function renderResourceHelp(resource: Resource): string {
  const verbs = supportedVerbs(resource);
  const fields = fieldFlags(resource);
  const parents = parentPlaceholders(resource);
  const parentPrefix =
    parents.length > 0 ? parents.map((p) => `--${p} <id> `).join('') : '';

  const lines: string[] = [];
  const desc = resource.schema.description;
  lines.push(desc ? `${resource.singular} — ${desc}` : resource.singular);
  lines.push('');
  lines.push('Usage:');
  for (const verb of verbs) {
    lines.push(`  homestead resources ${parentPrefix}${resource.singular} ${usageForVerb(verb, fields, resource)}`);
  }

  const settable = fields.filter((f) => !f.fileField);
  if (settable.length > 0) {
    lines.push('', 'Fields:');
    const width = Math.max(...settable.map((f) => f.name.length), 4);
    for (const f of settable) {
      const req = f.required ? '  (required)' : '';
      const note = f.description ? `  ${f.description}` : '';
      lines.push(`  --${f.name.padEnd(width)}  ${f.type}${req}${note}`);
    }
  }

  const fileFields = fields.filter((f) => f.fileField);
  if (fileFields.length > 0) {
    lines.push('', 'File fields (set via the app, not the CLI):');
    for (const f of fileFields) lines.push(`  ${f.name}`);
  }

  if (parents.length > 0) {
    lines.push('', 'Parent ids (required, before the verb):');
    for (const p of parents) lines.push(`  --${p} <id>`);
  }

  return lines.join('\n');
}

function usageForVerb(verb: Verb, fields: FieldFlag[], resource: Resource): string {
  switch (verb) {
    case 'list':
      return 'list';
    case 'get':
      return 'get <id>';
    case 'delete':
      return 'delete <id>';
    case 'update':
      return 'update <id> [--field value ...]';
    case 'create': {
      const idHint = resource.createMethod?.supportsUserSettableCreate ? '--id <id> ' : '';
      const required = fields
        .filter((f) => f.required && !f.fileField)
        .map((f) => `--${f.name} <${f.type}>`)
        .join(' ');
      return `create ${idHint}${required}`.trimEnd();
    }
  }
}
