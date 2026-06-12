import { test, expect } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Resource } from '@aep_dev/aep-lib-ts';
import {
  buildBody,
  buildItemPath,
  collectParentParams,
  fieldFlags,
  FlagError,
  parentPlaceholders,
} from './resources-flags.ts';

const giftCard: Resource = {
  singular: 'gift-card',
  plural: 'gift-cards',
  parents: [],
  children: [],
  patternElems: ['gift-cards', '{gift-card}'],
  schema: {
    type: 'object',
    properties: {
      merchant: { type: 'string' },
      amount: { type: 'number' },
      count: { type: 'integer' },
      active: { type: 'boolean' },
      tags: { type: 'array', items: { type: 'string' } },
      metadata: { type: 'object' },
      front_image: { type: 'string', format: 'binary' },
      create_time: { type: 'string', readOnly: true },
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
  schema: {
    type: 'object',
    properties: { transaction_type: { type: 'string' } },
    required: ['transaction_type'],
  },
  listMethod: { hasUnreachableResources: false, supportsFilter: false, supportsSkip: false },
  getMethod: {},
  createMethod: { supportsUserSettableCreate: false },
  deleteMethod: {},
  customMethods: [],
};

const reserved = (r: Resource): Set<string> =>
  new Set([...parentPlaceholders(r), '@data', 'id']);

test('fieldFlags skips readOnly fields and marks file + required fields', () => {
  const fields = fieldFlags(giftCard);
  const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
  expect(byName.create_time).toBeUndefined();
  expect(byName.merchant).toMatchObject({ type: 'string', required: true });
  expect(byName.amount).toMatchObject({ type: 'number', required: true });
  expect(byName.count.type).toBe('integer');
  expect(byName.active.type).toBe('boolean');
  expect(byName.tags.type).toBe('array');
  expect(byName.metadata.type).toBe('object');
  expect(byName.front_image.fileField).toBe(true);
});

test('parentPlaceholders reflects the pattern hierarchy', () => {
  expect(parentPlaceholders(giftCard)).toEqual([]);
  expect(parentPlaceholders(transaction)).toEqual(['gift-card']);
});

test('collectParentParams reads parent flags and errors when missing', () => {
  expect(collectParentParams(transaction, { 'gift-card': 'abc' })).toEqual({
    'gift-card': 'abc',
  });
  expect(() => collectParentParams(transaction, {})).toThrow(FlagError);
});

test('buildItemPath interpolates parents and the item id', () => {
  expect(buildItemPath(giftCard, {}, 'g1')).toBe('gift-cards/g1');
  expect(buildItemPath(transaction, { 'gift-card': 'abc' }, 'tx1')).toBe(
    'gift-cards/abc/transactions/tx1',
  );
});

test('buildBody coerces each field to its schema type', () => {
  const body = buildBody(
    giftCard,
    fieldFlags(giftCard),
    {
      id: 'gc1',
      merchant: 'Foo',
      amount: '25.5',
      count: '3',
      active: true,
      tags: 'a, b ,c',
      metadata: '{"k":"v"}',
    },
    { forCreate: true, reserved: reserved(giftCard) },
  );
  expect(body).toEqual({
    id: 'gc1',
    merchant: 'Foo',
    amount: 25.5,
    count: 3,
    active: true,
    tags: ['a', 'b', 'c'],
    metadata: { k: 'v' },
  });
});

test('create enforces required fields and a user-settable id', () => {
  expect(() =>
    buildBody(giftCard, fieldFlags(giftCard), { merchant: 'Foo' }, {
      forCreate: true,
      reserved: reserved(giftCard),
    }),
  ).toThrow(/required field/);

  expect(() =>
    buildBody(giftCard, fieldFlags(giftCard), { merchant: 'Foo', amount: '1' }, {
      forCreate: true,
      reserved: reserved(giftCard),
    }),
  ).toThrow(/--id/);
});

test('update needs neither id nor required fields', () => {
  const body = buildBody(giftCard, fieldFlags(giftCard), { amount: '30' }, {
    forCreate: false,
    reserved: reserved(giftCard),
  });
  expect(body).toEqual({ amount: 30 });
});

test('rejects unknown flags and file-field flags', () => {
  expect(() =>
    buildBody(giftCard, fieldFlags(giftCard), { nope: 'x' }, {
      forCreate: false,
      reserved: reserved(giftCard),
    }),
  ).toThrow(/unknown flag/);

  expect(() =>
    buildBody(giftCard, fieldFlags(giftCard), { front_image: 'x' }, {
      forCreate: false,
      reserved: reserved(giftCard),
    }),
  ).toThrow(/file field/);
});

test('--@data supplies the whole body but cannot mix with field flags', () => {
  const path = join(tmpdir(), `.tmp-data-${process.pid}.json`);
  writeFileSync(path, JSON.stringify({ id: 'gc1', merchant: 'Foo', amount: 5 }));
  try {
    const body = buildBody(giftCard, fieldFlags(giftCard), { '@data': path }, {
      forCreate: true,
      reserved: reserved(giftCard),
    });
    expect(body).toMatchObject({ merchant: 'Foo', amount: 5 });

    expect(() =>
      buildBody(giftCard, fieldFlags(giftCard), { '@data': path, merchant: 'Bar' }, {
        forCreate: true,
        reserved: reserved(giftCard),
      }),
    ).toThrow(/cannot be combined/);
  } finally {
    rmSync(path, { force: true });
  }
});
