import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const PEOPLE = 'people' as const;
export const PERSON_SHARED_DATA = 'person-shared-data' as const;
export const ADDRESSES = 'addresses' as const;

export const peopleResources: ResourceDefinition[] = [
  {
    singular: 'person',
    plural: PEOPLE,
    description:
      'A person tracked by the household (family, friend, contact).',
    user_settable_create: true,
    fields: {
      name: { type: 'string', required: true },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
    bulkImport: {
      formats: [
        {
          id: 'csv',
          label: 'CSV',
          inputType: 'file',
          accept: '.csv',
          hasTemplate: true,
          load: () => import('./methods/bulk-import-csv'),
        },
      ],
      // A person's address and partner live in sibling resources, and partners
      // can reference someone created later in the same file — so people needs
      // the whole selection at once, not a row-at-a-time create.
      save: () => import('./methods/bulk-import-csv'),
    },
  },
  {
    singular: 'person-shared-data',
    plural: PERSON_SHARED_DATA,
    description:
      "Data shared between two people (e.g. a couple's shared address).",
    user_settable_create: true,
    fields: {
      person_a: {
        type: 'string',
        reference: { resource: 'person' },
        required: true,
      },
      person_b: { type: 'string', reference: { resource: 'person' } },
      address_id: { type: 'string', reference: { resource: 'address' } },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
  {
    singular: 'address',
    plural: ADDRESSES,
    description:
      'A physical address, optionally with WiFi credentials, optionally shared between people.',
    user_settable_create: true,
    fields: {
      line1: { type: 'string', required: true },
      line2: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      postal_code: { type: 'string' },
      country: { type: 'string' },
      wifi_network: { type: 'string' },
      wifi_password: { type: 'string' },
      shared_data_id: {
        type: 'string',
        reference: { resource: 'person-shared-data' },
      },
      created_by: { type: 'string', required: true, reference: { resource: 'user' } },
    },
  },
];
