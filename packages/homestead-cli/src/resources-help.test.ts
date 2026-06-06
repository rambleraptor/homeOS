import { test, expect } from 'bun:test';
import type { Resource } from '@aep_dev/aep-lib-ts';
import { renderIndex, renderResourceHelp, supportedVerbs } from './resources-help.ts';

const giftCard: Resource = {
  singular: 'gift-card',
  plural: 'gift-cards',
  parents: [],
  children: [],
  patternElems: ['gift-cards', '{gift-card}'],
  schema: {
    type: 'object',
    description: 'A stored-value card.',
    properties: {
      merchant: { type: 'string' },
      amount: { type: 'number' },
      front_image: { type: 'string', format: 'binary' },
    },
    required: ['merchant', 'amount'],
  },
  listMethod: { hasUnreachableResources: false, supportsFilter: false, supportsSkip: false },
  getMethod: {},
  createMethod: { supportsUserSettableCreate: true },
  updateMethod: {},
  deleteMethod: {},
  customMethods: [],
};

const transaction: Resource = {
  singular: 'transaction',
  plural: 'transactions',
  parents: [giftCard],
  children: [],
  patternElems: ['gift-cards', '{gift-card}', 'transactions', '{transaction}'],
  schema: { type: 'object', properties: { transaction_type: { type: 'string' } } },
  listMethod: { hasUnreachableResources: false, supportsFilter: false, supportsSkip: false },
  getMethod: {},
  createMethod: { supportsUserSettableCreate: false },
  deleteMethod: {},
  customMethods: [],
};

test('supportedVerbs gates on the resource methods', () => {
  expect(supportedVerbs(giftCard)).toEqual(['list', 'get', 'create', 'update', 'delete']);
  // transaction has no updateMethod
  expect(supportedVerbs(transaction)).toEqual(['list', 'get', 'create', 'delete']);
});

test('renderIndex lists resources, verbs, and parent annotations', () => {
  const out = renderIndex({ 'gift-card': giftCard, transaction });
  expect(out).toContain('gift-card');
  expect(out).toContain('list, get, create, update, delete');
  expect(out).toContain('transaction');
  expect(out).toContain('(parent: --gift-card)');
});

test('renderResourceHelp shows usage, required markers, and file fields', () => {
  const out = renderResourceHelp(giftCard);
  expect(out).toContain('gift-card — A stored-value card.');
  expect(out).toContain('--merchant');
  expect(out).toContain('(required)');
  // user-settable create surfaces the --id hint and required fields
  expect(out).toContain('create --id <id> --merchant <string> --amount <number>');
  // binary field is documented as app-only, not a settable flag
  expect(out).toContain('File fields');
  expect(out).toContain('front_image');
});

test('renderResourceHelp prefixes nested usage with parent flags', () => {
  const out = renderResourceHelp(transaction);
  expect(out).toContain('--gift-card <id> transaction list');
  expect(out).not.toContain('transaction update'); // no update verb
});
