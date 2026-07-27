/**
 * Doc-type validation, merging, and compilation into schema variants + Zod.
 *
 * The built-in types are imported here (not fixtured), so a typo in a shipped
 * doc type — a non-kebab id, a mistyped field, a missing icon — fails this suite
 * rather than surfacing at boot.
 */

import { describe, expect, it } from 'vitest';
import { FileText } from 'lucide-react';
import {
  validateDocType,
  toVariants,
  toZodUnion,
  UNKNOWN_DOC_TYPE,
  type DocType,
} from '../doc-types/docType';
import { BUILTIN_DOC_TYPES } from '../doc-types/builtins';
import type { LazyIcon } from '@rambleraptor/homestead-core/apps/types';

/** A stand-in lazy icon for the test doc types below. */
const stubIcon: LazyIcon = () => Promise.resolve(FileText);

/** A minimal well-formed doc type, spread over in the invalid-input cases. */
const wellFormed = {
  id: 'form-x',
  label: 'Form X',
  description: 'A form.',
  icon: stubIcon,
  fields: { payer_name: { label: 'Payer name', type: 'string', description: 'Who paid.' } },
};

const type = (id: string, fields: DocType['fields']): DocType => ({
  id,
  label: id,
  description: `the ${id}`,
  icon: stubIcon,
  fields,
});

describe('validateDocType', () => {
  it('accepts a well-formed doc type', () => {
    expect(validateDocType(wellFormed, 'form-x.ts')).toEqual(wellFormed);
  });

  it('names the offending file in every error', () => {
    expect(() => validateDocType({ id: 'Form_X' }, 'bad.ts')).toThrow(/"bad\.ts"/);
  });

  it('rejects a non-object module export', () => {
    expect(() => validateDocType(undefined, 'x.ts')).toThrow(/must default-export/);
  });

  it('rejects a non-kebab-case id', () => {
    expect(() => validateDocType({ ...wellFormed, id: 'formX' }, 'x.ts')).toThrow(
      /must be kebab-case/,
    );
  });

  it('reserves the unknown id', () => {
    expect(() =>
      validateDocType({ ...wellFormed, id: UNKNOWN_DOC_TYPE }, 'x.ts'),
    ).toThrow(/reserved for unmatched documents/);
  });

  it('requires a description — it is what the model classifies on', () => {
    expect(() =>
      validateDocType({ ...wellFormed, description: undefined }, 'x.ts'),
    ).toThrow(/description is required/);
  });

  it('requires an icon', () => {
    expect(() => validateDocType({ ...wellFormed, icon: undefined }, 'x.ts')).toThrow(
      /icon is required/,
    );
  });

  it('rejects non-snake_case field names', () => {
    expect(() =>
      validateDocType(
        { ...wellFormed, fields: { payerName: { label: 'P', type: 'string' } } },
        'x.ts',
      ),
    ).toThrow(/"payerName" must be snake_case/);
  });

  it('rejects unsupported field types', () => {
    expect(() =>
      validateDocType(
        { ...wellFormed, fields: { paid: { label: 'P', type: 'boolean' } } },
        'x.ts',
      ),
    ).toThrow(/type must be "string", "number", "array", or "object"/);
  });

  it('rejects a doc type with no fields', () => {
    expect(() => validateDocType({ ...wellFormed, fields: {} }, 'x.ts')).toThrow(
      /declares no fields/,
    );
  });

  it('accepts array and object fields with their nested shapes', () => {
    const ingredients = {
      ...wellFormed,
      fields: {
        items: {
          label: 'Items',
          type: 'array',
          items: {
            label: 'Item',
            type: 'object',
            properties: {
              name: { label: 'Name', type: 'string' },
              qty: { label: 'Qty', type: 'number' },
            },
          },
        },
      },
    };
    expect(() => validateDocType(ingredients, 'x.ts')).not.toThrow();
  });

  it('rejects an array field with no items', () => {
    expect(() =>
      validateDocType(
        { ...wellFormed, fields: { list: { label: 'List', type: 'array' } } },
        'x.ts',
      ),
    ).toThrow(/array field "list" must declare items/);
  });

  it('rejects an object field with no properties', () => {
    expect(() =>
      validateDocType(
        { ...wellFormed, fields: { blob: { label: 'Blob', type: 'object' } } },
        'x.ts',
      ),
    ).toThrow(/object field "blob" must declare properties/);
  });

  it('rejects a non-snake_case nested property name', () => {
    expect(() =>
      validateDocType(
        {
          ...wellFormed,
          fields: {
            row: {
              label: 'Row',
              type: 'object',
              properties: { badName: { label: 'B', type: 'string' } },
            },
          },
        },
        'x.ts',
      ),
    ).toThrow(/"row\.badName" must be snake_case/);
  });

  it('accepts a person marker on a string field and preserves it', () => {
    const parsed = validateDocType(
      {
        ...wellFormed,
        fields: { patient: { label: 'Patient', type: 'string', person: true } },
      },
      'x.ts',
    );
    expect(parsed.fields.patient!.person).toBe(true);
  });

  it('rejects a person marker on a non-string field', () => {
    expect(() =>
      validateDocType(
        { ...wellFormed, fields: { amount: { label: 'Amount', type: 'number', person: true } } },
        'x.ts',
      ),
    ).toThrow(/person is only valid on a string field/);
  });

  it('rejects a non-boolean person marker', () => {
    expect(() =>
      validateDocType(
        { ...wellFormed, fields: { who: { label: 'Who', type: 'string', person: 'yes' } } },
        'x.ts',
      ),
    ).toThrow(/person must be a boolean/);
  });

  it('accepts an optional post_classify function and rejects a non-function', () => {
    const hook = () => Promise.resolve({ default: async () => undefined });
    expect(() =>
      validateDocType({ ...wellFormed, post_classify: hook }, 'x.ts'),
    ).not.toThrow();
    expect(() =>
      validateDocType({ ...wellFormed, post_classify: 'nope' }, 'x.ts'),
    ).toThrow(/post_classify must be a function/);
  });
});

describe('toVariants', () => {
  it('compiles doc types into FieldDef variants plus the unknown variant', () => {
    const variants = toVariants([
      type('form-w2', { wages: { label: 'Wages', type: 'number', description: 'Box 1.' } }),
    ]);
    expect(variants['form-w2']).toEqual({
      wages: { type: 'number', singular_name: 'Wages', description: 'Box 1.' },
    });
    // Unmatched documents are a real member of the union, carrying only a tag.
    expect(variants[UNKNOWN_DOC_TYPE]).toEqual({});
  });

  it('allows a shared field name when the types agree', () => {
    expect(() =>
      toVariants([
        type('a', { amount: { label: 'Amount', type: 'number' } }),
        type('b', { amount: { label: 'Amount', type: 'number' } }),
      ]),
    ).not.toThrow();
  });

  it('rejects a shared field name whose type differs, naming both doc types', () => {
    expect(() =>
      toVariants([
        type('form-a', { amount: { label: 'Amount', type: 'number' } }),
        type('form-b', { amount: { label: 'Amount', type: 'string' } }),
      ]),
    ).toThrow(/"amount" is a number in doc type "form-a" but a string in "form-b"/);
  });

  it('compiles an array-of-object field into a nested FieldDef', () => {
    const variants = toVariants([
      type('recipe', {
        parsed_ingredients: {
          label: 'Ingredients',
          type: 'array',
          description: 'The list.',
          items: {
            label: 'Ingredient',
            type: 'object',
            properties: {
              item: { label: 'Item', type: 'string' },
              qty: { label: 'Qty', type: 'number' },
            },
          },
        },
      }),
    ]);
    expect(variants.recipe.parsed_ingredients).toEqual({
      type: 'array',
      singular_name: 'Ingredients',
      description: 'The list.',
      items: {
        type: 'object',
        singular_name: 'Ingredient',
        properties: {
          item: { type: 'string', singular_name: 'Item' },
          qty: { type: 'number', singular_name: 'Qty' },
        },
      },
    });
  });
});

describe('toZodUnion', () => {
  const union = () =>
    toZodUnion([
      type('form-w2', {
        employer: { label: 'Employer', type: 'string' },
        wages: { label: 'Wages', type: 'number' },
      }),
    ]);

  it('accepts a full match', () => {
    expect(
      union().parse({ doc_type: 'form-w2', employer: 'Acme', wages: 90000 }),
    ).toEqual({ doc_type: 'form-w2', employer: 'Acme', wages: 90000 });
  });

  it('accepts a partial read — absent fields come back as null, not omitted', () => {
    // Fields are `.nullable()`, not `.optional()`: the model emits every key,
    // using null for the ones it can't find (see toZodUnion — that is what keeps
    // Gemini from aborting the structured-output call). A null survives
    // validation; an omitted key does not, so classify strips the nulls itself.
    expect(
      union().parse({ doc_type: 'form-w2', employer: 'Acme', wages: null }),
    ).toEqual({ doc_type: 'form-w2', employer: 'Acme', wages: null });
    expect(() => union().parse({ doc_type: 'form-w2' })).toThrow();
  });

  it('always offers the unknown variant', () => {
    expect(union().parse({ doc_type: UNKNOWN_DOC_TYPE })).toEqual({
      doc_type: UNKNOWN_DOC_TYPE,
    });
  });

  it('rejects an unknown tag and a mistyped field', () => {
    expect(() => union().parse({ doc_type: 'form-nope' })).toThrow();
    expect(() => union().parse({ doc_type: 'form-w2', wages: '90000' })).toThrow();
  });

  it('parses a composite array-of-object field', () => {
    const recipeUnion = toZodUnion([
      type('recipe', {
        parsed_ingredients: {
          label: 'Ingredients',
          type: 'array',
          items: {
            label: 'Ingredient',
            type: 'object',
            properties: {
              item: { label: 'Item', type: 'string' },
              qty: { label: 'Qty', type: 'number' },
            },
          },
        },
      }),
    ]);
    const parsed = recipeUnion.parse({
      doc_type: 'recipe',
      // A per-ingredient null models "unfound" — object props are nullable, so
      // this survives validation (classify/hook strip the nulls before storing).
      parsed_ingredients: [
        { item: 'flour', qty: 2 },
        { item: 'salt', qty: null },
      ],
    });
    expect(parsed).toEqual({
      doc_type: 'recipe',
      parsed_ingredients: [
        { item: 'flour', qty: 2 },
        { item: 'salt', qty: null },
      ],
    });
    // The whole composite field is nullable too — a recipe with no list read.
    expect(
      recipeUnion.parse({ doc_type: 'recipe', parsed_ingredients: null }),
    ).toEqual({ doc_type: 'recipe', parsed_ingredients: null });
  });
});

describe('the built-in doc types', () => {
  it('expose the expected ids', () => {
    expect(BUILTIN_DOC_TYPES.map((t) => t.id).sort()).toEqual([
      'auto-insurance-policy',
      'form-1099-int',
      'form-w2',
      'medical-receipt',
      'recipe',
    ]);
  });

  it('validate cleanly', () => {
    for (const t of BUILTIN_DOC_TYPES) {
      expect(() => validateDocType(t, `${t.id}.ts`)).not.toThrow();
    }
  });

  it('compile to variants without a field-type conflict', () => {
    // The types share no field names today; this guards the next one added.
    expect(() => toVariants(BUILTIN_DOC_TYPES)).not.toThrow();
  });

  it('carry a description on every field — the lever on extraction quality', () => {
    for (const t of BUILTIN_DOC_TYPES) {
      for (const [name, field] of Object.entries(t.fields)) {
        expect(field.description, `${t.id}.${name}`).toBeTruthy();
      }
    }
  });

  it('carry an icon', () => {
    for (const t of BUILTIN_DOC_TYPES) {
      expect(typeof t.icon, t.id).toBe('function');
    }
  });
});
