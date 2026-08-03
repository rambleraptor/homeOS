/**
 * Property tax statement — a local government's real estate tax bill.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Not a
 * federal form, so layout varies by county — classify on the presence of a
 * taxing authority, a parcel, an assessed value, and a tax amount due.
 */

import type { DocType } from './docType';

const propertyTaxStatement: DocType = {
  id: 'property-tax-statement',
  label: 'Property tax statement',
  icon: () => import('lucide-react').then((m) => m.Building),
  category: 'tax',
  title_template: 'Property Tax ({tax_year}) — {taxing_authority}',
  description:
    'A local government real estate property tax bill or statement, listing the ' +
    'taxing authority, the parcel, its assessed value, and the tax due. Layout ' +
    'varies by county/municipality; deductible real estate taxes are drawn from it.',
  fields: {
    taxing_authority: {
      label: 'Taxing authority',
      type: 'string',
      description:
        'The county, city, or district that issued the bill (e.g. "King County ' +
        'Treasurer").',
    },
    taxpayer_name: {
      label: 'Taxpayer name',
      type: 'string',
      person: true,
      description: 'The property owner the bill is addressed to, as printed.',
    },
    property_address: {
      label: 'Property address',
      type: 'string',
      description: 'The address of the taxed property.',
    },
    parcel_number: {
      label: 'Parcel number',
      type: 'string',
      description:
        'The parcel or assessor\'s ID number identifying the property (also called an ' +
        'APN or tax account number).',
    },
    assessed_value: {
      label: 'Assessed value',
      type: 'number',
      description: 'The total assessed or taxable value of the property.',
    },
    total_tax_due: {
      label: 'Total tax due',
      type: 'number',
      description: 'The total property tax due for the period, before any early-payment discount.',
    },
    tax_year: {
      label: 'Tax year',
      type: 'number',
      description: 'The tax year the statement covers, as a four-digit year (e.g. 2024).',
    },
  },
};

export default propertyTaxStatement;
