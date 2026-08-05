/**
 * The `classify` body contract: parsing an optional forced `doc_type`.
 *
 * Kept pure (no AI, no client) so it runs as a plain unit test. A real known id
 * is read off the registry rather than hardcoded, so adding/renaming a shipped
 * type can never quietly rot this suite.
 */

import { describe, expect, it } from 'vitest';
import { parseForcedDocType } from '../methods/forced-type';
import { getDocTypes } from '../doc-types/registry';

/** A stub body reader — the parser only needs `text()`. */
function body(value?: string): Pick<Request, 'text'> {
  return { text: async () => value ?? '' };
}

/** A reader whose `text()` rejects, standing in for an unreadable body. */
const unreadable: Pick<Request, 'text'> = {
  text: async () => {
    throw new Error('stream already consumed');
  },
};

describe('parseForcedDocType', () => {
  const knownId = getDocTypes()[0]!.id;

  it('treats a blank or missing body as no override', async () => {
    expect(await parseForcedDocType(body())).toEqual({ kind: 'none' });
    expect(await parseForcedDocType(body(''))).toEqual({ kind: 'none' });
    expect(await parseForcedDocType(body('   '))).toEqual({ kind: 'none' });
  });

  it('treats an unreadable body as no override', async () => {
    expect(await parseForcedDocType(unreadable)).toEqual({ kind: 'none' });
  });

  it('tolerates a non-JSON body as no override', async () => {
    expect(await parseForcedDocType(body('not json'))).toEqual({ kind: 'none' });
  });

  it('treats a body without a doc_type key as no override', async () => {
    expect(await parseForcedDocType(body('{}'))).toEqual({ kind: 'none' });
    expect(await parseForcedDocType(body('{"other":1}'))).toEqual({ kind: 'none' });
    expect(await parseForcedDocType(body('{"doc_type":null}'))).toEqual({ kind: 'none' });
  });

  it('ignores a non-object JSON body', async () => {
    expect(await parseForcedDocType(body('[1,2]'))).toEqual({ kind: 'none' });
    expect(await parseForcedDocType(body('"hello"'))).toEqual({ kind: 'none' });
  });

  it('forces a known doc type', async () => {
    expect(await parseForcedDocType(body(JSON.stringify({ doc_type: knownId })))).toEqual({
      kind: 'forced',
      docType: knownId,
    });
  });

  it('trims surrounding whitespace on a forced id', async () => {
    expect(
      await parseForcedDocType(body(JSON.stringify({ doc_type: `  ${knownId}  ` }))),
    ).toEqual({ kind: 'forced', docType: knownId });
  });

  it('rejects the reserved unknown tag', async () => {
    const res = await parseForcedDocType(body(JSON.stringify({ doc_type: 'unknown' })));
    expect(res.kind).toBe('invalid');
  });

  it('rejects an unregistered id', async () => {
    const res = await parseForcedDocType(
      body(JSON.stringify({ doc_type: 'not-a-real-type' })),
    );
    expect(res.kind).toBe('invalid');
  });

  it('rejects a non-string doc_type', async () => {
    expect((await parseForcedDocType(body('{"doc_type":42}'))).kind).toBe('invalid');
    expect((await parseForcedDocType(body('{"doc_type":""}'))).kind).toBe('invalid');
  });
});
