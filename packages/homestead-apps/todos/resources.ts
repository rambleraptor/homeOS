import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

/**
 * Collection plural identifiers — the URL segment aepbase uses for each
 * resource. Hooks should import these directly so renaming a collection
 * is a single-file change.
 */
export const TODOS = 'todos' as const;
export const PROJECTS = 'projects' as const;
export const LIST_TEMPLATES = 'list-templates' as const;
export const TEMPLATE_ITEMS = 'template-items' as const;

export const todosResources: ResourceDefinition[] = [
  {
    singular: 'project',
    plural: PROJECTS,
    description: 'A todo project (e.g. Kitchen Remodel, Garden).',
    user_settable_create: true,
    fields: {
      name: { type: 'string', description: 'Project name.', required: true },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
  {
    singular: 'todo',
    plural: TODOS,
    description: 'A household todo item.',
    user_settable_create: true,
    fields: {
      title: { type: 'string', description: 'Todo title.', required: true },
      status: {
        type: 'string',
        enum: ['pending', 'do_later', 'completed', 'cancelled'],
        required: true,
      },
      created_by: { type: 'string', reference: { resource: 'user' } },
      project: {
        type: 'string',
        description: 'empty/missing means the main project.',
        reference: { resource: 'project', onDelete: 'restrict' },
      },
      in_main: {
        type: 'boolean',
        description:
          'When true, the todo also appears on the main project view (only meaningful when project is set).',
      },
    },
  },
  {
    singular: 'list-template',
    plural: LIST_TEMPLATES,
    description:
      'A reusable checklist template. Instantiating one creates a new project pre-filled with its items.',
    user_settable_create: true,
    fields: {
      name: { type: 'string', description: 'Template name.', required: true },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
  {
    singular: 'template-item',
    plural: TEMPLATE_ITEMS,
    parents: ['list-template'],
    description: 'A single item within a list template.',
    user_settable_create: true,
    fields: {
      title: { type: 'string', description: 'Item title.', required: true },
    },
  },
];
