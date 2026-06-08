import type { Resource } from '@aep_dev/aep-lib-ts';
import { fieldFlags, parentPlaceholders, type FieldFlag } from './resources-flags.ts';
import type { CustomMethodInfo } from './resources-model.ts';

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

/** The custom methods that live on a given resource, by plural match. */
export function customMethodsFor(
  resource: Resource,
  customMethods: CustomMethodInfo[],
): CustomMethodInfo[] {
  return customMethods.filter((m) => m.plural === resource.plural);
}

/** The `homestead resources` index: every resource, its verbs + custom methods. */
export function renderIndex(
  resources: Record<string, Resource>,
  customMethods: CustomMethodInfo[] = [],
): string {
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
    const parentSuffix =
      parents.length > 0 ? `   (parent: ${parents.map((p) => `--${p}`).join(' ')})` : '';
    const methods = customMethodsFor(r, customMethods);
    const methodSuffix =
      methods.length > 0
        ? `   (custom: ${methods.map((m) => `:${m.verb}`).join(', ')})`
        : '';
    lines.push(`  ${r.singular.padEnd(width)}  ${verbs}${parentSuffix}${methodSuffix}`);
  }
  lines.push('', 'Run `homestead resources <resource>` for fields and usage.');
  return lines.join('\n');
}

/** Per-resource help: usage lines, fields, custom methods, and parent flags. */
export function renderResourceHelp(
  resource: Resource,
  customMethods: CustomMethodInfo[] = [],
): string {
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
  for (const m of customMethodsFor(resource, customMethods)) {
    const idHint = m.target === 'item' ? '<id> ' : '';
    lines.push(
      `  homestead resources ${parentPrefix}${resource.singular} ${m.verb} ${idHint}[--@data body.json]`,
    );
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

  const methods = customMethodsFor(resource, customMethods);
  if (methods.length > 0) {
    lines.push('', 'Custom methods (AEP-136, served by the sidecar):');
    const width = Math.max(...methods.map((m) => m.verb.length), 4);
    for (const m of methods) {
      const scope = m.target === 'item' ? 'per-record (pass <id>)' : 'collection';
      lines.push(`  ${m.verb.padEnd(width)}  ${m.method} :${m.verb}  (${scope})`);
    }
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
