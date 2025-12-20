/**
 * People Bulk Import - Schema Definition
 */

import type { BulkImportSchema } from '@/shared/bulk-import';
import type { PersonFormData } from '../types';
import {
  validateName,
  validateAddress,
  validateBirthday,
  validateAnniversary,
  validateNotificationPreferences,
} from './validators';
import { PersonPreview } from './PersonPreview';

/**
 * CSV headers for people import
 */
const REQUIRED_HEADERS = ['name'] as const;

const OPTIONAL_HEADERS = [
  'address',
  'birthday',
  'anniversary',
  'notification_preferences',
] as const;

const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS] as const;

/**
 * Generate CSV template for people
 */
function generateTemplate(): string {
  const headers = ALL_HEADERS.join(',');
  const example1 =
    'John Doe,"123 Main St, Anytown, USA",1990-06-15,,"day_of,week_before"';
  const example2 =
    'Jane Smith,"456 Oak Ave, Someplace, USA",,2015-08-20,"day_of"';

  return `${headers}\n${example1}\n${example2}`;
}

/**
 * People bulk import schema
 */
export const peopleImportSchema: BulkImportSchema<PersonFormData> = {
  requiredFields: [
    {
      name: 'name',
      required: true,
      validator: validateName,
      description: 'Full name of the person (max 200 characters)',
    },
  ],
  optionalFields: [
    {
      name: 'address',
      required: false,
      validator: validateAddress,
      description: 'Full address (max 500 characters)',
    },
    {
      name: 'birthday',
      required: false,
      validator: validateBirthday,
      description: 'Birthday in YYYY-MM-DD format',
    },
    {
      name: 'anniversary',
      required: false,
      validator: validateAnniversary,
      description: 'Anniversary in YYYY-MM-DD format',
    },
    {
      name: 'notification_preferences',
      required: false,
      validator: validateNotificationPreferences,
      defaultValue: ['day_of'],
      description:
        'Comma-separated: "day_of", "day_before", "week_before" (default: "day_of")',
    },
  ],
  generateTemplate,
  PreviewComponent: PersonPreview,
};
