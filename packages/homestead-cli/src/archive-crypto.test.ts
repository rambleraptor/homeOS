import { describe, expect, test } from 'vitest';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import {
  ARCHIVE_FORMAT_VERSION,
  ArchiveDecryptError,
  DecryptBody,
  EncryptBody,
  generateBackupKeypair,
  hasArchiveMagic,
  MAGIC,
  openHeader,
  parseIdentity,
  parseRecipient,
  readHeader,
  recipientFingerprint,
  recipientForIdentity,
  sealHeader,
  type ArchiveMeta,
} from './archive-crypto.ts';

const CHUNK_SIZE = 64 * 1024;

function meta(recipient: string): ArchiveMeta {
  return {
    format: ARCHIVE_FORMAT_VERSION,
    created_at: '2026-01-01T00:00:00.000Z',
    homestead_version: '0.2.0',
    recipient,
  };
}

async function sealBody(dek: Buffer, plaintext: Buffer): Promise<Buffer> {
  return buffer(Readable.from([plaintext]).pipe(new EncryptBody(dek)));
}

async function openBody(dek: Buffer, body: Buffer): Promise<Buffer> {
  return buffer(Readable.from([body]).pipe(new DecryptBody(dek)));
}

describe('key encoding', () => {
  test('generates a distinct identity and recipient', () => {
    const a = generateBackupKeypair();
    const b = generateBackupKeypair();
    expect(a.identity).toMatch(/^hsbk1sk_[A-Za-z0-9_-]+$/);
    expect(a.recipient).toMatch(/^hsbk1_[A-Za-z0-9_-]+$/);
    expect(a.identity).not.toBe(b.identity);
    expect(a.recipient).not.toBe(b.recipient);
  });

  test('the identity never contains the recipient (or vice versa)', () => {
    const { identity, recipient } = generateBackupKeypair();
    expect(identity).not.toContain(recipient.replace('hsbk1_', ''));
  });

  test('derives the recipient from the identity', () => {
    const { identity, recipient } = generateBackupKeypair();
    expect(recipientForIdentity(identity)).toBe(recipient);
  });

  test('the PKCS#8 preamble this module hardcodes matches the runtime', () => {
    // If a runtime ever encoded X25519 keys differently, identities would stop
    // rebuilding — so assert the assumption rather than trusting it.
    const { privateKey } = generateKeyPairSync('x25519');
    const der = privateKey.export({ type: 'pkcs8', format: 'der' });
    expect(der.length).toBe(48);
    expect(der.subarray(0, 16).toString('hex')).toBe('302e020100300506032b656e04220420');
  });

  test('rejects a key with the wrong prefix', () => {
    const { identity, recipient } = generateBackupKeypair();
    expect(() => parseRecipient(identity)).toThrow(/not a backup recipient/);
    expect(() => parseIdentity(recipient)).toThrow(/not a backup identity/);
  });

  test('rejects a key of the wrong length', () => {
    expect(() => parseRecipient(`hsbk1_${Buffer.alloc(8).toString('base64url')}`)).toThrow(
      /must decode to 32 bytes/,
    );
  });

  test('tolerates trailing whitespace from a key file', () => {
    const { recipient } = generateBackupKeypair();
    expect(recipientFingerprint(`${recipient}\n`)).toBe(recipientFingerprint(recipient));
  });
});

describe('recipientFingerprint', () => {
  test('is stable per recipient and differs across recipients', () => {
    const a = generateBackupKeypair().recipient;
    const b = generateBackupKeypair().recipient;
    expect(recipientFingerprint(a)).toBe(recipientFingerprint(a));
    expect(recipientFingerprint(a)).not.toBe(recipientFingerprint(b));
    expect(recipientFingerprint(a)).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('header', () => {
  test('is readable without any key', () => {
    const { recipient } = generateBackupKeypair();
    const { header } = sealHeader(recipient, meta(recipient));

    const { meta: read } = readHeader(header);
    expect(read.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(read.recipient).toBe(recipient);
    expect(hasArchiveMagic(header)).toBe(true);
  });

  test('yields the data key to the matching identity', () => {
    const { identity, recipient } = generateBackupKeypair();
    const { header, dek } = sealHeader(recipient, meta(recipient));
    expect(openHeader(header, identity).dek.equals(dek)).toBe(true);
  });

  test('refuses a different identity', () => {
    const { recipient } = generateBackupKeypair();
    const other = generateBackupKeypair();
    const { header } = sealHeader(recipient, meta(recipient));
    expect(() => openHeader(header, other.identity)).toThrow(ArchiveDecryptError);
    expect(() => openHeader(header, other.identity)).toThrow(/wrong backup key/);
  });

  test('detects an edited header — the metadata is bound to the key wrap', () => {
    const { identity, recipient } = generateBackupKeypair();
    const { header } = sealHeader(recipient, meta(recipient));
    const tampered = Buffer.from(header);
    const at = tampered.indexOf(Buffer.from('2026-01-01'));
    expect(at).toBeGreaterThan(0);
    tampered.write('2020-01-01', at);

    expect(() => openHeader(tampered, identity)).toThrow(ArchiveDecryptError);
  });

  test('rejects a future format version', () => {
    const { recipient } = generateBackupKeypair();
    const { header } = sealHeader(recipient, meta(recipient));
    const bumped = Buffer.from(header);
    bumped[MAGIC.length] = ARCHIVE_FORMAT_VERSION + 1;
    expect(() => readHeader(bumped)).toThrow(/upgrade homestead/);
  });

  test('rejects bytes that are not an archive', () => {
    expect(() => readHeader(Buffer.from('just a tarball'))).toThrow(/not an encrypted homestead/);
    expect(hasArchiveMagic(Buffer.from('nope'))).toBe(false);
  });

  test('rejects a truncated header', () => {
    const { recipient } = generateBackupKeypair();
    const { header } = sealHeader(recipient, meta(recipient));
    expect(() => readHeader(header.subarray(0, header.length - 4))).toThrow(/truncated/);
  });
});

describe('body round trip', () => {
  const sizes: Array<[string, number]> = [
    ['empty', 0],
    ['one byte', 1],
    ['just under one chunk', CHUNK_SIZE - 1],
    ['exactly one chunk', CHUNK_SIZE],
    ['one chunk plus a byte', CHUNK_SIZE + 1],
    ['several chunks', CHUNK_SIZE * 3 + 77],
  ];

  test.each(sizes)('round-trips %s', async (_label, size) => {
    const dek = randomBytes(32);
    const plaintext = randomBytes(size);
    const body = await sealBody(dek, plaintext);
    expect(body.length).toBeGreaterThan(plaintext.length); // per-chunk tags
    expect((await openBody(dek, body)).equals(plaintext)).toBe(true);
  });

  test('survives being written in many small pieces', async () => {
    const dek = randomBytes(32);
    const plaintext = randomBytes(CHUNK_SIZE * 2 + 5);
    const pieces: Buffer[] = [];
    for (let i = 0; i < plaintext.length; i += 1000) pieces.push(plaintext.subarray(i, i + 1000));

    const body = await buffer(Readable.from(pieces).pipe(new EncryptBody(dek)));
    expect((await openBody(dek, body)).equals(plaintext)).toBe(true);
  });

  test('refuses the wrong data key', async () => {
    const body = await sealBody(randomBytes(32), Buffer.from('secrets'));
    await expect(openBody(randomBytes(32), body)).rejects.toThrow(ArchiveDecryptError);
  });

  test('detects a flipped bit in the body', async () => {
    const dek = randomBytes(32);
    const body = await sealBody(dek, randomBytes(CHUNK_SIZE * 2));
    body[100] ^= 0xff;
    await expect(openBody(dek, body)).rejects.toThrow(/has been altered/);
  });

  test('detects a truncated body rather than restoring what survived', async () => {
    // The failure this format exists to prevent: a cut-off archive must not
    // decrypt to a plausible-looking prefix.
    const dek = randomBytes(32);
    const plaintext = randomBytes(CHUNK_SIZE * 3);
    const body = await sealBody(dek, plaintext);

    await expect(openBody(dek, body.subarray(0, body.length - 500))).rejects.toThrow(
      ArchiveDecryptError,
    );
    // Even dropping a whole trailing frame is caught: the last frame standing
    // was sealed as non-final, so it cannot authenticate as the final one.
    const oneFrame = CHUNK_SIZE + 16;
    await expect(openBody(dek, body.subarray(0, body.length - oneFrame))).rejects.toThrow(
      /truncated or altered/,
    );
  });

  test('detects reordered chunks', async () => {
    const dek = randomBytes(32);
    const body = await sealBody(dek, randomBytes(CHUNK_SIZE * 2 + 10));
    const frame = CHUNK_SIZE + 16;
    const swapped = Buffer.concat([
      body.subarray(frame, frame * 2),
      body.subarray(0, frame),
      body.subarray(frame * 2),
    ]);
    await expect(openBody(dek, swapped)).rejects.toThrow(ArchiveDecryptError);
  });
});

describe('end to end', () => {
  test('a full archive opens only with its identity', async () => {
    const { identity, recipient } = generateBackupKeypair();
    const payload = randomBytes(CHUNK_SIZE + 999);

    const { header, dek } = sealHeader(recipient, meta(recipient));
    const archive = Buffer.concat([header, await sealBody(dek, payload)]);

    const opened = openHeader(archive, identity);
    const body = archive.subarray(opened.headerLen);
    expect((await openBody(opened.dek, body)).equals(payload)).toBe(true);

    const stranger = generateBackupKeypair();
    expect(() => openHeader(archive, stranger.identity)).toThrow(ArchiveDecryptError);
  });
});
