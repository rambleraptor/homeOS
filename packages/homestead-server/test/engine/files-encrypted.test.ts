import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { call, defineResource, makeEngine, type TestEngine } from './helpers';
import { filePath } from '../../src/engine/files';
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
        attachment: { type: 'binary', 'x-aepbase-file-field': true },
      },
      required: ['name', 'attachment'],
    },
  });
  expect(res.status).toBe(200);
});

afterEach(() => {
  delete process.env.HOMESTEAD_MASTER_KEY;
  __resetMasterKeyCacheForTests();
});

function multipart(fields: Record<string, string | Blob>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') form.append(k, v);
    else form.append(k, v, 'upload.bin');
  }
  return form;
}

async function upload(id: string, content: string): Promise<void> {
  const res = await call(t.engine, 'POST', `/docs?id=${id}`, {
    token: t.adminToken,
    form: multipart({ name: 'R', attachment: new Blob([content]) }),
  });
  expect(res.status).toBe(200);
}

describe('encrypted file bytes at rest', () => {
  test('on-disk bytes are ciphertext but download round-trips the plaintext', async () => {
    await upload('d1', 'the-secret-content');

    const disk = readFileSync(filePath(t.filesDir, 'docs/d1', 'attachment'));
    expect(disk.subarray(0, 6).toString('ascii')).toBe('HSENC1'); // container magic
    expect(disk.toString('utf8')).not.toContain('the-secret-content');

    const dl = await call(t.engine, 'POST', '/docs/d1:download', {
      token: t.adminToken,
      body: { field: 'attachment' },
    });
    expect(dl.status).toBe(200);
    expect(await dl.text()).toBe('the-secret-content');
  });

  test('the wire response still echoes a download URL, not the marker', async () => {
    await upload('d2', 'x');
    const got = await (await call(t.engine, 'GET', '/docs/d2', { token: t.adminToken })).json();
    expect(got.attachment).toBe('http://localhost:8090/docs/d2:download?field=attachment');
  });

  test('download fails closed (500) when the master key is gone', async () => {
    await upload('d3', 'confidential');
    delete process.env.HOMESTEAD_MASTER_KEY;
    __resetMasterKeyCacheForTests();

    const dl = await call(t.engine, 'POST', '/docs/d3:download', {
      token: t.adminToken,
      body: { field: 'attachment' },
    });
    expect(dl.status).toBe(500);
    expect((await dl.json()).error.message).toContain('cannot decrypt');
  });
});
