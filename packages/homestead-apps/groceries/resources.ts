import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const STORES = 'stores' as const;
export const GROCERIES = 'groceries' as const;

export const groceriesResources: ResourceDefinition[] = [
  {
    singular: 'store',
    plural: STORES,
    description: 'A grocery store (used to group grocery items).',
    user_settable_create: true,
    fields: {
      name: { type: 'string', required: true },
      sort_order: { type: 'number' },
      created_by: { type: 'string' },
    },
  },
  {
    singular: 'grocery',
    plural: GROCERIES,
    description: "A single item on the household's shared grocery list.",
    user_settable_create: true,
    fields: {
      name: { type: 'string', required: true },
      // Quick-add omits `checked`; the engine fills this default so every
      // grocery persists as unchecked rather than with the field absent.
      checked: { type: 'boolean', default: false },
      category: { type: 'string' },
      notes: { type: 'string' },
      store: { type: 'string', description: 'stores/{store_id}' },
      created_by: { type: 'string' },
    },
    // AEP-136 custom methods on the grocery collection:
    //   POST /api/v1/aep/groceries:process-image
    //   POST /api/v1/aep/groceries:send-notification
    customMethods: {
      'process-image': {
        target: 'collection',
        load: () => import('./methods/process-image'),
      },
      'send-notification': {
        target: 'collection',
        load: () => import('./methods/send-notification'),
      },
    },
  },
];
