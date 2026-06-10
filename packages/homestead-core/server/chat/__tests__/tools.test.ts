/**
 * Tests for the chat app's resource-definition → Gemini tool mapping.
 */

import { describe, it, expect } from 'vitest';
import { SchemaType } from '@google/generative-ai';
import { buildTools } from '../tools';
import type { ResourceDefinition } from '../../../resources/types';

const giftCard: ResourceDefinition = {
  singular: 'gift-card',
  plural: 'gift-cards',
  description: 'A stored-value gift card.',
  schema: {
    type: 'object',
    properties: {
      merchant: { type: 'string' },
      amount: { type: 'number' },
      archived: { type: 'boolean' },
      front_image: {
        type: 'binary',
        'x-aepbase-file-field': true,
        description: 'Front-of-card image',
      },
    },
    required: ['merchant', 'amount', 'front_image'],
  },
};

const transaction: ResourceDefinition = {
  singular: 'transaction',
  plural: 'transactions',
  parents: ['gift-card'],
  schema: {
    type: 'object',
    properties: {
      transaction_type: { type: 'string', description: 'one of: decrement, set' },
      new_amount: { type: 'number' },
    },
    required: ['transaction_type', 'new_amount'],
  },
};

const notification: ResourceDefinition = {
  singular: 'notification',
  plural: 'notifications',
  parents: ['user'],
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      subscription_data: { type: 'object' },
      scheduled_for: { type: 'string', format: 'date-time' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['title'],
  },
};

// Two-level nesting: redemption → perk → credit-card.
const creditCard: ResourceDefinition = {
  singular: 'credit-card',
  plural: 'credit-cards',
  schema: { type: 'object', properties: { name: { type: 'string' } } },
};
const perk: ResourceDefinition = {
  singular: 'perk',
  plural: 'perks',
  parents: ['credit-card'],
  schema: { type: 'object', properties: { name: { type: 'string' } } },
};
const redemption: ResourceDefinition = {
  singular: 'redemption',
  plural: 'redemptions',
  parents: ['perk'],
  schema: { type: 'object', properties: { notes: { type: 'string' } } },
};

const ALL = [giftCard, transaction, notification, creditCard, perk, redemption];

describe('buildTools', () => {
  it('generates four tools per resource with snake_case names', () => {
    const { declarations, bindings } = buildTools(ALL);
    expect(declarations).toHaveLength(ALL.length * 4);
    for (const name of [
      'create_gift_card',
      'read_gift_card',
      'update_gift_card',
      'delete_gift_card',
    ]) {
      expect(bindings.has(name)).toBe(true);
    }
  });

  it('produces only valid Gemini function names', () => {
    const { declarations } = buildTools(ALL);
    for (const decl of declarations) {
      expect(decl.name).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/);
    }
  });

  it('strips binary/file fields, including from required', () => {
    const { declarations } = buildTools([giftCard]);
    const create = declarations.find((d) => d.name === 'create_gift_card')!;
    expect(create.parameters!.properties).not.toHaveProperty('front_image');
    expect(create.parameters!.required).toEqual(['merchant', 'amount']);
  });

  it('adds a required parent id param for parented resources', () => {
    const { declarations, bindings } = buildTools(ALL);
    const create = declarations.find((d) => d.name === 'create_transaction')!;
    expect(create.parameters!.properties).toHaveProperty('gift_card_id');
    expect(create.parameters!.required).toContain('gift_card_id');
    expect(bindings.get('create_transaction')).toMatchObject({
      parentChain: ['gift-card'],
      parentPlurals: ['gift-cards'],
    });
  });

  it('treats user as a built-in parent root', () => {
    const { declarations, bindings } = buildTools([notification]);
    const read = declarations.find((d) => d.name === 'read_notification')!;
    expect(read.parameters!.properties).toHaveProperty('user_id');
    expect(read.parameters!.required).toEqual(['user_id']);
    expect(bindings.get('read_notification')).toMatchObject({
      parentChain: ['user'],
      parentPlurals: ['users'],
    });
  });

  it('resolves multi-level parent chains root first', () => {
    const { declarations, bindings } = buildTools(ALL);
    const create = declarations.find((d) => d.name === 'create_redemption')!;
    expect(Object.keys(create.parameters!.properties)).toEqual(
      expect.arrayContaining(['credit_card_id', 'perk_id', 'notes']),
    );
    expect(bindings.get('create_redemption')).toMatchObject({
      parentChain: ['credit-card', 'perk'],
      parentPlurals: ['credit-cards', 'perks'],
    });
  });

  it('declares free-form objects as JSON strings and records them', () => {
    const { declarations, bindings } = buildTools([notification]);
    const create = declarations.find((d) => d.name === 'create_notification')!;
    const prop = create.parameters!.properties.subscription_data;
    expect(prop.type).toBe(SchemaType.STRING);
    expect(prop.description).toContain('JSON object');
    expect(bindings.get('create_notification')!.jsonStringFields).toEqual(
      new Set(['subscription_data']),
    );
  });

  it('keeps date-time formats and converts arrays', () => {
    const { declarations } = buildTools([notification]);
    const create = declarations.find((d) => d.name === 'create_notification')!;
    expect(create.parameters!.properties.scheduled_for).toMatchObject({
      type: SchemaType.STRING,
      format: 'date-time',
    });
    expect(create.parameters!.properties.tags).toMatchObject({
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    });
  });

  it('read takes an optional id; update and delete require it', () => {
    const { declarations } = buildTools([giftCard]);
    const read = declarations.find((d) => d.name === 'read_gift_card')!;
    expect(read.parameters!.properties).toHaveProperty('id');
    expect(read.parameters!.required).toEqual([]);

    const update = declarations.find((d) => d.name === 'update_gift_card')!;
    expect(update.parameters!.required).toEqual(['id']);
    // Update fields are all optional (merge patch).
    expect(update.parameters!.properties).toHaveProperty('merchant');

    const del = declarations.find((d) => d.name === 'delete_gift_card')!;
    expect(del.parameters!.required).toEqual(['id']);
    expect(del.parameters!.properties).not.toHaveProperty('merchant');
  });

  it('copies enum-in-description conventions through', () => {
    const { declarations } = buildTools(ALL);
    const create = declarations.find((d) => d.name === 'create_transaction')!;
    expect(create.parameters!.properties.transaction_type.description).toBe(
      'one of: decrement, set',
    );
  });
});
