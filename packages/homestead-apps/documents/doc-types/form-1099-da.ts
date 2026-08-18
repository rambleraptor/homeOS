/**
 * Form 1099-DA — proceeds from digital asset (crypto) sales.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 *
 * New: brokers began reporting digital asset dispositions on this form for the
 * 2025 tax year, so it first reached taxpayers in early 2026. Cost basis is
 * phased in behind proceeds, which is why Box 1e is frequently blank on early
 * forms even though Box 1d is filled.
 *
 * It is the digital-asset counterpart of Form 1099-B and deliberately shares its
 * columns (`box_1d_proceeds`, `box_1e_cost_basis`, `date_acquired`, `date_sold`,
 * …): the same fact about a disposal, whichever asset it was.
 */

import type { DocType } from './docType';

const form1099Da: DocType = {
  id: 'form-1099-da',
  label: 'Form 1099-DA',
  icon: () => import('lucide-react').then((m) => m.Bitcoin),
  category: 'tax',
  title_template: '1099-DA ({tax_year}) — {payer_name}',
  description:
    'A US tax form reporting sales and exchanges of digital assets — ' +
    'cryptocurrency, stablecoins, and NFTs — handled by a broker or exchange. ' +
    'Titled "Form 1099-DA" and "Digital Asset Proceeds From Broker ' +
    'Transactions". Issued by an exchange such as Coinbase or Kraken. Resembles ' +
    'Form 1099-B but names a digital asset rather than a stock or bond.',
  fields: {
    payer_name: {
      label: 'Broker name',
      type: 'string',
      description:
        'The broker or digital asset exchange that issued the form, from the ' +
        "PAYER'S name block, top left.",
    },
    payer_tin: {
      label: "Broker's TIN",
      type: 'string',
      description: "The broker's federal tax ID number, labelled PAYER'S TIN.",
    },
    recipient_name: {
      label: 'Recipient name',
      type: 'string',
      person: true,
      description: 'The account holder the form was issued to, as printed.',
    },
    recipient_tin: {
      label: "Recipient's TIN",
      type: 'string',
      description:
        "The recipient's SSN or taxpayer ID. Often masked except for the last " +
        'four digits — record exactly what is printed.',
    },
    digital_asset_code: {
      label: 'Digital asset',
      type: 'string',
      description:
        'The asset that was sold, from the digital asset code/name box (Box 1a) — ' +
        'a ticker such as BTC or ETH, or the asset\'s name.',
    },
    units_sold: {
      label: 'Units sold',
      type: 'number',
      description:
        'The quantity of the digital asset disposed of. Often fractional (e.g. ' +
        '0.0425) — record the full precision printed.',
    },
    date_acquired: {
      label: 'Date acquired',
      type: 'string',
      description:
        'When the asset was acquired, from Box 1b. May read "various" when the ' +
        'sale drew on lots bought at different times — record that word if so.',
    },
    date_sold: {
      label: 'Date sold or disposed',
      type: 'string',
      description: 'When the asset was sold, exchanged, or otherwise disposed of, from Box 1c.',
    },
    box_1d_proceeds: {
      label: 'Box 1d: Proceeds',
      type: 'number',
      description:
        'The gross proceeds from the disposal, from Box 1d. A plain number, no ' +
        'currency symbol.',
    },
    box_1e_cost_basis: {
      label: 'Box 1e: Cost or other basis',
      type: 'number',
      description:
        'What the asset cost, from Box 1e. Frequently blank on early forms — ' +
        'basis reporting phased in after proceeds reporting. Leave it out when ' +
        'the box is empty rather than guessing.',
    },
    box_1g_wash_sale_loss_disallowed: {
      label: 'Box 1g: Wash sale loss disallowed',
      type: 'number',
      description: 'Any loss disallowed under the wash sale rules, from Box 1g.',
    },
    box_4_federal_tax_withheld: {
      label: 'Box 4: Federal income tax withheld',
      type: 'number',
      description:
        'Federal tax already withheld, from Box 4. Typically backup withholding, ' +
        'and usually zero.',
    },
    tax_year: {
      label: 'Tax year',
      type: 'number',
      description:
        'The tax year this form reports, as a four-digit year (e.g. 2025). ' +
        'Usually printed near the form title (often as "For calendar year ' +
        'YYYY") or in a corner of the form.',
    },
  },
};

export default form1099Da;
