import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { randomBytes } from 'node:crypto';
import { call, defineResource, makeEngine, type TestEngine } from './helpers';
import { __resetMasterKeyCacheForTests } from '../../src/engine/crypto';

const KEY = randomBytes(32).toString('base64');
let t: TestEngine;

beforeEach(async () => {
  process.env.HOMESTEAD_MASTER_KEY = KEY;
  __resetMasterKeyCacheForTests();
  t = await makeEngine();
  const res = await defineResource(t, {
    singular: 'doc',
    plural: 'docs',
    user_settable_create: true,
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        // The engine treats this like the companion translate.ts synthesizes.
        file_text: { type: 'string', 'x-aepbase-file-text-field': true },
      },
      required: ['name'],
    },
  });
  expect(res.status).toBe(200);
});

afterEach(() => {
  delete process.env.HOMESTEAD_MASTER_KEY;
  __resetMasterKeyCacheForTests();
});

function rawTextColumn(path: string): string | null {
  const row = t.engine.db
    .query('SELECT file_text FROM docs WHERE path = ?')
    .get(path) as { file_text: string | null } | null;
  return row ? row.file_text : null;
}

describe('encrypted extracted-text column', () => {
  test('stored ciphertext on create, decrypted on read', async () => {
    const create = await call(t.engine, 'POST', '/docs?id=d1', {
      token: t.adminToken,
      body: { name: 'R', file_text: 'secret extracted words' },
    });
    expect(create.status).toBe(200);
    // Response is decrypted for the caller...
    expect((await create.json()).file_text).toBe('secret extracted words');
    // ...but the raw column is ciphertext behind the enc:v1: flag.
    const raw = rawTextColumn('docs/d1');
    expect(raw?.startsWith('enc:v1:')).toBe(true);
    expect(raw).not.toContain('secret extracted words');

    const got = await (await call(t.engine, 'GET', '/docs/d1', { token: t.adminToken })).json();
    expect(got.file_text).toBe('secret extracted words');
  });

  test('PATCH (the extraction pipeline path) re-encrypts', async () => {
    await call(t.engine, 'POST', '/docs?id=d2', { token: t.adminToken, body: { name: 'R' } });
    const patch = await call(t.engine, 'PATCH', '/docs/d2', {
      token: t.adminToken,
      body: { file_text: 'ocr output' },
    });
    expect(patch.status).toBe(200);
    expect(rawTextColumn('docs/d2')?.startsWith('enc:v1:')).toBe(true);
    const got = await (await call(t.engine, 'GET', '/docs/d2', { token: t.adminToken })).json();
    expect(got.file_text).toBe('ocr output');
  });

  test('filtering on the encrypted text field is rejected (400)', async () => {
    await call(t.engine, 'POST', '/docs?id=d3', {
      token: t.adminToken,
      body: { name: 'R', file_text: 'findme' },
    });
    const list = await call(t.engine, 'GET', '/docs?filter=' + encodeURIComponent('file_text == "findme"'), {
      token: t.adminToken,
    });
    expect(list.status).toBe(400);
    expect((await list.json()).error.message).toContain('encrypted');
  });

  test('read fails closed when the key is gone (no plaintext leak)', async () => {
    await call(t.engine, 'POST', '/docs?id=d4', {
      token: t.adminToken,
      body: { name: 'R', file_text: 'confidential' },
    });
    delete process.env.HOMESTEAD_MASTER_KEY;
    __resetMasterKeyCacheForTests();

    const res = await call(t.engine, 'GET', '/docs/d4', { token: t.adminToken });
    expect(res.status).not.toBe(200);
    expect(await res.text()).not.toContain('confidential');
  });

  test('with no key configured, text stays plaintext (backward compatible)', async () => {
    delete process.env.HOMESTEAD_MASTER_KEY;
    __resetMasterKeyCacheForTests();
    await call(t.engine, 'POST', '/docs?id=d5', {
      token: t.adminToken,
      body: { name: 'R', file_text: 'plain' },
    });
    expect(rawTextColumn('docs/d5')).toBe('plain');
    const got = await (await call(t.engine, 'GET', '/docs/d5', { token: t.adminToken })).json();
    expect(got.file_text).toBe('plain');
  });
});
