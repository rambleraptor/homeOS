/**
 * Schedule K-1 — a partner's or shareholder's share of income, deductions, and
 * credits from a partnership or S corporation.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Covers the
 * common Form 1065 (partnership) and Form 1120-S (S corp) K-1 variants.
 */

import type { DocType } from './docType';

const scheduleK1: DocType = {
  id: 'schedule-k-1',
  label: 'Schedule K-1',
  icon: () => import('lucide-react').then((m) => m.Share2),
  category: 'tax',
  title_template: 'Schedule K-1 ({tax_year}) — {entity_name}',
  description:
    "A US tax form reporting a partner's or shareholder's share of a pass-through " +
    'entity\'s income, deductions, and credits. Titled "Schedule K-1", from Form ' +
    '1065 (partnership) or Form 1120-S (S corporation), with Part I (entity), Part ' +
    'II (partner), and Part III (share of income) sections.',
  fields: {
    entity_name: {
      label: 'Entity name',
      type: 'string',
      description: 'The partnership or S corporation issuing the K-1, from Part I.',
    },
    entity_ein: {
      label: "Entity's EIN",
      type: 'string',
      description: "The entity's Employer Identification Number, from Part I.",
    },
    partner_name: {
      label: 'Partner / shareholder name',
      type: 'string',
      person: true,
      description: 'The partner or shareholder the K-1 is for, from Part II.',
    },
    partner_tin: {
      label: "Partner's TIN",
      type: 'string',
      description:
        "The partner's or shareholder's SSN or taxpayer ID, often masked except for " +
        'the last four digits.',
    },
    ordinary_business_income: {
      label: 'Ordinary business income (loss)',
      type: 'number',
      description:
        'The share of ordinary business income or loss, from Part III box 1. A loss ' +
        'is negative.',
    },
    net_rental_real_estate_income: {
      label: 'Net rental real estate income (loss)',
      type: 'number',
      description: 'The share of net rental real estate income or loss, from Part III box 2.',
    },
    interest_income: {
      label: 'Interest income',
      type: 'number',
      description: 'The share of interest income, from the Part III interest-income box.',
    },
    dividend_income: {
      label: 'Ordinary dividend income',
      type: 'number',
      description: 'The share of ordinary dividends, from the Part III dividend box.',
    },
    tax_year: {
      label: 'Tax year',
      type: 'number',
      description: 'The tax year the K-1 covers, as a four-digit year (e.g. 2024).',
    },
  },
};

export default scheduleK1;
