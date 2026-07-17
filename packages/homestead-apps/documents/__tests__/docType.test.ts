/**
 * Doc-type parsing, merging, and compilation into schema variants + Zod.
 *
 * The built-in YAML is read from disk here rather than fixtured, so a typo in a
 * shipped doc type fails this suite rather than surfacing at boot.
 *
 * `readDocTypesDir` is given an explicit path rather than going through
 * `builtinDocTypesDir()`: that helper resolves `import.meta.url`, which Vite
 * rewrites to a non-file URL under this (jsdom) suite. It resolves correctly on
 * the server, which runs the module untransformed.
 */

import { describe, expect, it } from 'vitest';
import {
  mergeDocTypes,
  parseDocType,
  toVariants,
  toZodUnion,
  UNKNOWN_DOC_TYPE,
  type DocType,
} from '../doc-types/docType';
import { join } from 'node:path';
import { readDocTypesDir } from '../doc-types/loadDocTypes.server';

/** The shipped YAML, addressed from the vitest cwd (packages/homestead-app). */
const BUILTIN_DIR = join(process.cwd(), '..', 'homestead-apps', 'documents', 'doc-types');

const yaml = (body: string) => `id: form-x\nlabel: Form X\ndescription: A form.\n${body}`;

const type = (id: string, fields: DocType['fields']): DocType => ({
  id,
  label: id,
  description: `the ${id}`,
  fields,
});

describe('parseDocType', () => {
  it('parses a well-formed doc type', () => {
    const parsed = parseDocType(
      yaml('fields:\n  payer_name:\n    label: Payer name\n    type: string\n    description: Who paid.\n'),
      'form-x.yaml',
    );
    expect(parsed).toEqual({
      id: 'form-x',
      label: 'Form X',
      description: 'A form.',
      fields: {
        payer_name: { label: 'Payer name', type: 'string', description: 'Who paid.' },
      },
    });
  });

  it('names the offending file in every error', () => {
    expect(() => parseDocType('id: Form_X', 'bad.yaml')).toThrow(/"bad\.yaml"/);
  });

  it('rejects a non-kebab-case id', () => {
    expect(() => parseDocType('id: formX\nlabel: X\ndescription: d\nfields: {}', 'x.yaml')).toThrow(
      /must be kebab-case/,
    );
  });

  it('reserves the unknown id', () => {
    expect(() =>
      parseDocType(`id: ${UNKNOWN_DOC_TYPE}\nlabel: X\ndescription: d\nfields: {}`, 'x.yaml'),
    ).toThrow(/reserved for unmatched documents/);
  });

  it('requires a description — it is what the model classifies on', () => {
    expect(() => parseDocType('id: form-x\nlabel: X\nfields: {}', 'x.yaml')).toThrow(
      /description is required/,
    );
  });

  it('rejects non-snake_case field names', () => {
    expect(() =>
      parseDocType(yaml('fields:\n  payerName:\n    label: P\n    type: string\n'), 'x.yaml'),
    ).toThrow(/"payerName" must be snake_case/);
  });

  it('rejects unsupported field types', () => {
    expect(() =>
      parseDocType(yaml('fields:\n  paid:\n    label: P\n    type: boolean\n'), 'x.yaml'),
    ).toThrow(/type must be "string" or "number"/);
  });

  it('rejects a doc type with no fields', () => {
    expect(() => parseDocType(yaml('fields: {}'), 'x.yaml')).toThrow(/declares no fields/);
  });

  it('reports malformed YAML rather than throwing raw', () => {
    expect(() => parseDocType('id: [unclosed', 'x.yaml')).toThrow(/YAML did not parse/);
  });
});

describe('mergeDocTypes', () => {
  it('lets the project override a built-in by id, and sorts by id', () => {
    const merged = mergeDocTypes(
      [type('form-w2', { a: { label: 'A', type: 'string' } }), type('form-1099-int', {})],
      [type('form-w2', { b: { label: 'B', type: 'string' } })],
    );
    expect(merged.map((t) => t.id)).toEqual(['form-1099-int', 'form-w2']);
    // Wholesale replacement, not a field-level merge.
    expect(Object.keys(merged[1]!.fields)).toEqual(['b']);
  });

  it('keeps project-only types', () => {
    const merged = mergeDocTypes([], [type('form-1098', {})]);
    expect(merged.map((t) => t.id)).toEqual(['form-1098']);
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

  it('accepts a partial read — fields are optional so a partial parse survives', () => {
    expect(union().parse({ doc_type: 'form-w2' })).toEqual({ doc_type: 'form-w2' });
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
});

describe('the built-in doc types', () => {
  it('parse cleanly from disk', () => {
    const types = readDocTypesDir(BUILTIN_DIR);
    expect(types.map((t) => t.id)).toEqual(['form-1099-int', 'form-w2']);
  });

  it('compile to variants without a field-type conflict', () => {
    // The two share no field names today; this guards the next type added.
    expect(() => toVariants(readDocTypesDir(BUILTIN_DIR))).not.toThrow();
  });

  it('carry a description on every field — the lever on extraction quality', () => {
    for (const type of readDocTypesDir(BUILTIN_DIR)) {
      for (const [name, field] of Object.entries(type.fields)) {
        expect(field.description, `${type.id}.${name}`).toBeTruthy();
      }
    }
  });

  it('tolerate a missing doc-types directory', () => {
    expect(readDocTypesDir('/nonexistent/documents/types')).toEqual([]);
  });
});
