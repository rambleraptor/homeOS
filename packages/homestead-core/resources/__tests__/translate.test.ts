/**
 * Tests for the FieldDef → JSON-schema wire translation and the
 * boot-time definition validation.
 */

import { describe, expect, it } from 'vitest';
import { toWireSchema, validateResourceDefinition } from '../translate';
import type { ResourceDefinition } from '../types';

describe('toWireSchema', () => {
  it('wraps fields in a JSON-schema object and collects required', () => {
    expect(
      toWireSchema({
        merchant: { type: 'string', required: true },
        amount: { type: 'number', required: true },
        notes: { type: 'string' },
      }),
    ).toEqual({
      type: 'object',
      properties: {
        merchant: { type: 'string' },
        amount: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['merchant', 'amount'],
    });
  });

  it('omits the required array when no field is required', () => {
    expect(toWireSchema({ notes: { type: 'string' } })).toEqual({
      type: 'object',
      properties: { notes: { type: 'string' } },
    });
  });

  it('translates file fields to binary + x-aepbase-file-field', () => {
    expect(
      toWireSchema({
        receipt: { type: 'file', description: 'Receipt image' },
      }).properties.receipt,
    ).toEqual({
      type: 'binary',
      description: 'Receipt image',
      'x-aepbase-file-field': true,
    });
  });

  it('encodes enums into the description', () => {
    const { properties } = toWireSchema({
      status: { type: 'string', enum: ['pending', 'done'] },
      mode: {
        type: 'string',
        description: 'defaults to fast',
        enum: ['fast', 'slow'],
      },
    });
    expect(properties.status).toEqual({
      type: 'string',
      description: 'one of: pending, done',
    });
    expect(properties.mode).toEqual({
      type: 'string',
      description: 'defaults to fast (one of: fast, slow)',
    });
  });

  it('strips display names from the wire schema', () => {
    expect(
      toWireSchema({
        player: {
          type: 'string',
          singular_name: 'player',
          plural_name: 'players',
        },
      }).properties.player,
    ).toEqual({ type: 'string' });
  });

  it('recurses into array items and object properties', () => {
    expect(
      toWireSchema({
        scores: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              player: { type: 'string', required: true },
              strokes: { type: 'integer' },
            },
          },
        },
      }).properties.scores,
    ).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          player: { type: 'string' },
          strokes: { type: 'integer' },
        },
        required: ['player'],
      },
    });
  });

  it('passes format through', () => {
    expect(
      toWireSchema({
        due_at: { type: 'string', format: 'date-time' },
      }).properties.due_at,
    ).toEqual({ type: 'string', format: 'date-time' });
  });
});

describe('validateResourceDefinition', () => {
  const def = (
    overrides: Partial<ResourceDefinition>,
  ): ResourceDefinition => ({
    singular: 'gift-card',
    plural: 'gift-cards',
    fields: {},
    ...overrides,
  });

  it('accepts a well-formed definition', () => {
    expect(() =>
      validateResourceDefinition(
        def({
          fields: {
            card_number: { type: 'string', required: true },
            status: { type: 'string', enum: ['active', 'used'] },
            front_image: { type: 'file' },
          },
        }),
      ),
    ).not.toThrow();
  });

  it('rejects non-kebab-case singular/plural', () => {
    expect(() =>
      validateResourceDefinition(def({ singular: 'giftCard' })),
    ).toThrow(/must be kebab-case/);
    expect(() =>
      validateResourceDefinition(def({ plural: 'gift_cards' })),
    ).toThrow(/must be kebab-case/);
  });

  it('rejects non-snake_case field names, including nested ones', () => {
    expect(() =>
      validateResourceDefinition(
        def({ fields: { cardNumber: { type: 'string' } } }),
      ),
    ).toThrow(/"cardNumber" must be snake_case/);
    expect(() =>
      validateResourceDefinition(
        def({
          fields: {
            address: {
              type: 'object',
              properties: { zipCode: { type: 'string' } },
            },
          },
        }),
      ),
    ).toThrow(/"address.zipCode" must be snake_case/);
  });

  it('rejects enum on non-string fields', () => {
    expect(() =>
      validateResourceDefinition(
        def({ fields: { count: { type: 'number', enum: ['1'] } } }),
      ),
    ).toThrow(/declares enum but is not a string/);
  });

  it('rejects arrays without items and items on non-arrays', () => {
    expect(() =>
      validateResourceDefinition(
        def({ fields: { tags: { type: 'array' } } }),
      ),
    ).toThrow(/must declare items/);
    expect(() =>
      validateResourceDefinition(
        def({
          fields: { name: { type: 'string', items: { type: 'string' } } },
        }),
      ),
    ).toThrow(/declares items but is not an array/);
  });
});
