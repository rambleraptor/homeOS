/**
 * Tagged-union object fields: derived columns + filtering.
 *
 * A union's variant fields are projected into VIRTUAL generated columns over
 * the JSON blob, so `filter` can reach `metadata.box_1_interest` with a real
 * index while the blob stays the single source of truth.
 */

import { describe, expect, test } from 'vitest';
import { call, defineResource, makeEngine, type TestEngine } from './helpers';

/** `document` with an OpenAPI-standard discriminated union on `metadata`. */
const DOC_DEF = {
  singular: 'document',
  plural: 'documents',
  user_settable_create: true,
  schema: {
    type: 'object',
    properties: {
      full_text: { type: 'string' },
      metadata: {
        type: 'object',
        oneOf: [
          {
            type: 'object',
            required: ['doc_type'],
            properties: {
              doc_type: { type: 'string', enum: ['form-1099-int'] },
              payer_name: { type: 'string' },
              box_1_interest: { type: 'number' },
            },
          },
          {
            type: 'object',
            required: ['doc_type'],
            properties: {
              doc_type: { type: 'string', enum: ['form-w2'] },
              employer: { type: 'string' },
              wages: { type: 'number' },
            },
          },
        ],
        discriminator: { propertyName: 'doc_type' },
      },
    },
  },
};

async function seed(t: TestEngine): Promise<void> {
  await defineResource(t, DOC_DEF);
  const docs = [
    {
      full_text: 'ally 1099',
      metadata: { doc_type: 'form-1099-int', payer_name: 'Ally Bank', box_1_interest: 412.55 },
    },
    {
      full_text: 'chase 1099',
      metadata: { doc_type: 'form-1099-int', payer_name: 'Chase', box_1_interest: 91.2 },
    },
    {
      full_text: 'acme w2',
      metadata: { doc_type: 'form-w2', employer: 'Acme', wages: 90000 },
    },
    { full_text: 'a scanned letter, matches no type' },
  ];
  for (const body of docs) {
    const res = await call(t.engine, 'POST', '/documents', { token: t.adminToken, body });
    expect(res.status).toBe(201);
  }
}

async function filterFullText(t: TestEngine, filter: string): Promise<string[]> {
  const res = await call(
    t.engine,
    'GET',
    `/documents?filter=${encodeURIComponent(filter)}`,
    { token: t.adminToken },
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { results: { full_text: string }[] };
  return body.results.map((r) => r.full_text).sort();
}

describe('tagged-union derived columns', () => {
  test('the union blob round-trips unchanged', async () => {
    const t = await makeEngine();
    await seed(t);
    const [doc] = await filterFullText(t, "metadata.payer_name == 'Ally Bank'");
    expect(doc).toBe('ally 1099');
  });

  test('filters on a variant field, numerically', async () => {
    const t = await makeEngine();
    await seed(t);
    // Numeric, not lexical: '91.2' > '412.55' as strings.
    expect(await filterFullText(t, 'metadata.box_1_interest > 100')).toEqual(['ally 1099']);
    expect(await filterFullText(t, 'metadata.box_1_interest > 500')).toEqual([]);
  });

  test('filters on the discriminator tag', async () => {
    const t = await makeEngine();
    await seed(t);
    expect(await filterFullText(t, "metadata.doc_type == 'form-1099-int'")).toEqual([
      'ally 1099',
      'chase 1099',
    ]);
  });

  test('tag and variant field combine without narrowing', async () => {
    const t = await makeEngine();
    await seed(t);
    expect(
      await filterFullText(
        t,
        "metadata.doc_type == 'form-1099-int' && metadata.box_1_interest > 100",
      ),
    ).toEqual(['ally 1099']);
  });

  test("other variants' rows are excluded by NULL semantics", async () => {
    const t = await makeEngine();
    await seed(t);
    // The w2 and untyped rows have no box_1_interest: NULL > 0 is NULL, so
    // they drop out without an explicit doc_type constraint.
    expect(await filterFullText(t, 'metadata.box_1_interest > 0')).toEqual([
      'ally 1099',
      'chase 1099',
    ]);
    // Three-valued logic: `!=` also excludes them, which surprises people.
    expect(await filterFullText(t, 'metadata.wages != 1')).toEqual(['acme w2']);
  });

  test('a union field with no metadata at all is stored and listed', async () => {
    const t = await makeEngine();
    await seed(t);
    const res = await call(t.engine, 'GET', '/documents', { token: t.adminToken });
    const body = (await res.json()) as { results: unknown[] };
    expect(body.results).toHaveLength(4);
  });

  test('derived columns are not exposed as top-level fields', async () => {
    const t = await makeEngine();
    await seed(t);
    const res = await call(t.engine, 'GET', '/documents', { token: t.adminToken });
    const body = (await res.json()) as { results: Record<string, unknown>[] };
    const doc = body.results.find((r) => r.full_text === 'ally 1099')!;
    // box_1_interest lives inside metadata, never alongside it.
    expect(doc.box_1_interest).toBeUndefined();
    expect(doc.doc_type).toBeUndefined();
    expect(doc.metadata).toEqual({
      doc_type: 'form-1099-int',
      payer_name: 'Ally Bank',
      box_1_interest: 412.55,
    });
  });

  test('an unknown union path is still a 400, not a 500', async () => {
    const t = await makeEngine();
    await seed(t);
    const res = await call(
      t.engine,
      'GET',
      `/documents?filter=${encodeURIComponent('metadata.nope > 1')}`,
      { token: t.adminToken },
    );
    expect(res.status).toBe(400);
  });

  test('the filter seeks the generated index rather than scanning', async () => {
    const t = await makeEngine();
    await seed(t);
    const plan = t.engine.db
      .query(
        'EXPLAIN QUERY PLAN SELECT id FROM documents WHERE box_1_interest > ?',
      )
      .all(100) as { detail: string }[];
    expect(plan.map((p) => p.detail).join(' ')).toMatch(/USING INDEX/);
  });
});

describe('tagged unions in the generated OpenAPI', () => {
  const doc = async (t: TestEngine) => {
    const res = await call(t.engine, 'GET', '/openapi.json');
    expect(res.status).toBe(200);
    return (await res.json()) as any;
  };

  /** `document` def carrying the discriminator mapping the translator emits. */
  const MAPPED_DEF = {
    ...DOC_DEF,
    schema: {
      ...DOC_DEF.schema,
      properties: {
        ...DOC_DEF.schema.properties,
        metadata: {
          ...DOC_DEF.schema.properties.metadata,
          discriminator: {
            propertyName: 'doc_type',
            mapping: {
              'form-1099-int': '#/components/schemas/DocumentMetadataForm1099Int',
              'form-w2': '#/components/schemas/DocumentMetadataFormW2',
            },
          },
        },
      },
    },
  };

  test('variants are hoisted into components and referenced by $ref', async () => {
    const t = await makeEngine();
    await defineResource(t, MAPPED_DEF);
    const d = await doc(t);

    expect(d.components.schemas.document.properties.metadata.oneOf).toEqual([
      { $ref: '#/components/schemas/DocumentMetadataForm1099Int' },
      { $ref: '#/components/schemas/DocumentMetadataFormW2' },
    ]);
    expect(
      d.components.schemas.DocumentMetadataForm1099Int.properties.box_1_interest,
    ).toEqual({ type: 'number' });
  });

  test('every discriminator mapping target resolves to a real schema', async () => {
    const t = await makeEngine();
    await defineResource(t, MAPPED_DEF);
    const d = await doc(t);

    const mapping = d.components.schemas.document.properties.metadata.discriminator.mapping;
    for (const ref of Object.values(mapping) as string[]) {
      const name = ref.split('/').pop()!;
      expect(d.components.schemas[name], `${ref} must resolve`).toBeDefined();
    }
  });

  test('a union with no mapping stays inline rather than dangling', async () => {
    const t = await makeEngine();
    await defineResource(t, DOC_DEF); // discriminator, but no mapping
    const d = await doc(t);
    const oneOf = d.components.schemas.document.properties.metadata.oneOf;
    expect(oneOf[0].$ref).toBeUndefined();
    expect(oneOf[0].properties.payer_name).toEqual({ type: 'string' });
  });

  test('hoisting does not mutate the stored definition', async () => {
    const t = await makeEngine();
    await defineResource(t, MAPPED_DEF);
    await doc(t); // build once — must not corrupt the registry
    const res = await call(t.engine, 'GET', '/aep-resource-definitions', {
      token: t.adminToken,
    });
    const body = (await res.json()) as { results: any[] };
    const stored = body.results.find((r) => r.singular === 'document');
    // Still the real variant, not a $ref bleed-through.
    expect(stored.schema.properties.metadata.oneOf[0].properties.payer_name).toEqual({
      type: 'string',
    });
  });
});

describe('evolving a union (an operator edits a doc-type YAML)', () => {
  /** Build a `document` def whose 1099 variant carries `extraFields`. */
  const defWith = (extraFields: Record<string, unknown>, w2Wages = 'number') => ({
    singular: 'document',
    plural: 'documents',
    user_settable_create: true,
    schema: {
      type: 'object',
      properties: {
        full_text: { type: 'string' },
        metadata: {
          type: 'object',
          oneOf: [
            {
              type: 'object',
              required: ['doc_type'],
              properties: {
                doc_type: { type: 'string', enum: ['form-1099-int'] },
                payer_name: { type: 'string' },
                ...extraFields,
              },
            },
            {
              type: 'object',
              required: ['doc_type'],
              properties: {
                doc_type: { type: 'string', enum: ['form-w2'] },
                wages: { type: w2Wages },
              },
            },
          ],
          discriminator: { propertyName: 'doc_type' },
        },
      },
    },
  });

  const seedOne = async (t: TestEngine) =>
    call(t.engine, 'POST', '/documents', {
      token: t.adminToken,
      body: {
        full_text: 'ally 1099',
        metadata: { doc_type: 'form-1099-int', payer_name: 'Ally Bank', box_1_interest: 412.55 },
      },
    });

  test('adding a variant field creates its column and backfills existing rows', async () => {
    const t = await makeEngine();
    await defineResource(t, defWith({}));
    await seedOne(t); // written before the field was declared

    const patched = await call(t.engine, 'PATCH', '/aep-resource-definitions/document', {
      token: t.adminToken,
      body: defWith({ box_1_interest: { type: 'number' } }),
      contentType: 'application/merge-patch+json',
    });
    expect(patched.status).toBe(200);

    // The blob already held box_1_interest, so the new derived column sees it
    // with no backfill step.
    expect(await filterFullText(t, 'metadata.box_1_interest > 100')).toEqual(['ally 1099']);
  });

  test('removing a variant field drops its column and keeps the data', async () => {
    const t = await makeEngine();
    await defineResource(t, defWith({ box_1_interest: { type: 'number' } }));
    await seedOne(t);

    const patched = await call(t.engine, 'PATCH', '/aep-resource-definitions/document', {
      token: t.adminToken,
      body: defWith({}),
      contentType: 'application/merge-patch+json',
    });
    expect(patched.status).toBe(200);

    // The path no longer resolves...
    const res = await call(
      t.engine,
      'GET',
      `/documents?filter=${encodeURIComponent('metadata.box_1_interest > 100')}`,
      { token: t.adminToken },
    );
    expect(res.status).toBe(400);

    // ...but the value is untouched in the blob: nothing was destroyed.
    const list = await call(t.engine, 'GET', '/documents', { token: t.adminToken });
    const body = (await list.json()) as { results: any[] };
    expect(body.results[0].metadata.box_1_interest).toBe(412.55);
  });

  test('retyping a variant field rebuilds its column non-destructively', async () => {
    const t = await makeEngine();
    await defineResource(t, defWith({ box_1_interest: { type: 'number' } }));
    await seedOne(t);

    // number -> string: forbidden for a top-level field, but a variant field is
    // just a projection of the blob, so it only rebuilds the derived column.
    const patched = await call(t.engine, 'PATCH', '/aep-resource-definitions/document', {
      token: t.adminToken,
      body: defWith({ box_1_interest: { type: 'string' } }),
      contentType: 'application/merge-patch+json',
    });
    expect(patched.status).toBe(200);

    const list = await call(t.engine, 'GET', '/documents', { token: t.adminToken });
    const body = (await list.json()) as { results: any[] };
    expect(body.results[0].metadata.box_1_interest).toBe(412.55);
    expect(body.results[0].full_text).toBe('ally 1099');
  });

  test('promoting a variant field to a top-level field is non-destructive', async () => {
    // A union variant declares `tags`, so the live table has a derived `tags`
    // column. Then a real top-level `tags` field is added — a real column wins
    // the name clash, so the derived column is dropped and the top-level one
    // takes over. The PATCH must not try to ALTER ADD a column that already
    // exists as the derived one ("duplicate column name: tags").
    const t = await makeEngine();
    await defineResource(t, defWith({ tags: { type: 'array' } }));
    await call(t.engine, 'POST', '/documents', {
      token: t.adminToken,
      body: {
        full_text: 'ally 1099',
        metadata: { doc_type: 'form-1099-int', payer_name: 'Ally Bank', tags: ['x'] },
      },
    });

    const withTopLevelTags = defWith({ tags: { type: 'array' } }) as any;
    withTopLevelTags.schema.properties.tags = { type: 'array' };
    const patched = await call(t.engine, 'PATCH', '/aep-resource-definitions/document', {
      token: t.adminToken,
      body: withTopLevelTags,
      contentType: 'application/merge-patch+json',
    });
    expect(patched.status).toBe(200);

    // The record — and its union blob — survive the table recreate untouched.
    const list = await call(t.engine, 'GET', '/documents', { token: t.adminToken });
    const body = (await list.json()) as { results: any[] };
    expect(body.results).toHaveLength(1);
    expect(body.results[0].metadata.payer_name).toBe('Ally Bank');
    expect(body.results[0].full_text).toBe('ally 1099');
  });

  test('adding a whole new doc type keeps existing documents intact', async () => {
    const t = await makeEngine();
    await defineResource(t, defWith({ box_1_interest: { type: 'number' } }));
    await seedOne(t);

    const withNewType = defWith({ box_1_interest: { type: 'number' } }) as any;
    withNewType.schema.properties.metadata.oneOf.push({
      type: 'object',
      required: ['doc_type'],
      properties: {
        doc_type: { type: 'string', enum: ['form-1098'] },
        lender_name: { type: 'string' },
      },
    });
    const patched = await call(t.engine, 'PATCH', '/aep-resource-definitions/document', {
      token: t.adminToken,
      body: withNewType,
      contentType: 'application/merge-patch+json',
    });
    expect(patched.status).toBe(200);

    expect(await filterFullText(t, 'metadata.box_1_interest > 100')).toEqual(['ally 1099']);
    expect(await filterFullText(t, "metadata.lender_name == 'x'")).toEqual([]);
  });
});
