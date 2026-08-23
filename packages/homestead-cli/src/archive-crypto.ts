/**
 * Public-key encryption for backup archives.
 *
 * The point of the asymmetric design: the machine taking backups holds only a
 * *public* recipient key, so it cannot read back anything it has written. An
 * attacker who takes the box — or an unattended scheduled backup whose secrets
 * would otherwise have to live on that box — gets ciphertext and nothing else.
 * The private identity lives wherever you keep secrets, and is needed only to
 * restore.
 *
 * Format (`HSBACKUP`, version 1):
 *
 *   MAGIC(8) | version(1) | metaLen(2 BE) | meta(metaLen) | ephPub(32)
 *     | dekNonce(12) | dekCiphertext(32) | dekTag(16) | body
 *
 * The header is plaintext so an archive can identify itself — when it was
 * written, by which release, and which backup key opens it — without any key
 * present. Everything describing the *contents* (the manifest, file names,
 * sizes, checksums) is inside the encrypted body, because a file listing leaks
 * plenty on its own. The whole header is bound in as AAD when wrapping the
 * data key, so editing any of it invalidates the archive.
 *
 * Key agreement is X25519 to an ephemeral keypair, HKDF-SHA256 to a
 * key-encryption key, which wraps a random 32-byte data key (AES-256-GCM).
 *
 * The body is *chunked* rather than one big GCM blob, for two reasons. A
 * single GCM tag only arrives at the end of the stream, so streaming
 * decryption would have to hand unauthenticated plaintext to `tar` before
 * knowing whether it had been tampered with. And one key/nonce pair has a size
 * limit that a large archive could plausibly approach. So the body is
 * 64 KiB chunks, each sealed under a nonce of `counter || final-flag`: every
 * chunk authenticates before it is released, and because the last chunk is the
 * only one sealed with the final flag set, truncating the archive fails to
 * authenticate instead of silently restoring a partial data dir.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  type KeyObject,
} from 'node:crypto';
import { Transform, type TransformCallback } from 'node:stream';

export const MAGIC = Buffer.from('HSBACKUP', 'ascii');
export const ARCHIVE_FORMAT_VERSION = 1;

const CHUNK_SIZE = 64 * 1024;
const KEY_LEN = 32;
const NONCE_LEN = 12;
const TAG_LEN = 16;
const FRAME_LEN = CHUNK_SIZE + TAG_LEN;

/** Human-facing prefixes, so a key is recognisable when pasted somewhere. */
const RECIPIENT_PREFIX = 'hsbk1_';
const IDENTITY_PREFIX = 'hsbk1sk_';

/**
 * Fixed PKCS#8 preamble for an X25519 private key. Node and Bun both accept
 * only DER/JWK, and JWK requires the public half alongside the private — so an
 * identity is stored as its raw 32 bytes and re-wrapped in this preamble to
 * rebuild the key object. Asserted against a freshly generated key in the
 * tests, so a runtime that ever disagreed would fail loudly.
 */
const PKCS8_X25519_PREFIX = Buffer.from('302e020100300506032b656e04220420', 'hex');

/** Raised for every failure to open an archive: wrong key, tampering, truncation. */
export class ArchiveDecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchiveDecryptError';
  }
}

/** Plaintext, key-free description of an archive, carried in its header. */
export interface ArchiveMeta {
  format: number;
  created_at: string;
  homestead_version: string;
  /** The recipient this archive was encrypted to. */
  recipient: string;
}

export interface BackupKeypair {
  /** Secret. Needed only to restore; keep it off the machine being backed up. */
  identity: string;
  /** Public. Safe to leave on the machine taking backups. */
  recipient: string;
}

export function generateBackupKeypair(): BackupKeypair {
  const { privateKey, publicKey } = generateKeyPairSync('x25519');
  const raw = privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(PKCS8_X25519_PREFIX.length);
  return {
    identity: IDENTITY_PREFIX + Buffer.from(raw).toString('base64url'),
    recipient: RECIPIENT_PREFIX + rawPublic(publicKey).toString('base64url'),
  };
}

function rawPublic(key: KeyObject): Buffer {
  const jwk = key.export({ format: 'jwk' }) as { x?: string };
  if (!jwk.x) throw new Error('not an X25519 public key');
  return Buffer.from(jwk.x, 'base64url');
}

function decodeKeyBody(value: string, prefix: string, label: string): Buffer {
  const trimmed = value.trim();
  if (!trimmed.startsWith(prefix)) {
    throw new Error(`not a backup ${label} (expected it to start with "${prefix}")`);
  }
  const raw = Buffer.from(trimmed.slice(prefix.length), 'base64url');
  if (raw.length !== KEY_LEN) {
    throw new Error(`backup ${label} must decode to ${KEY_LEN} bytes, got ${raw.length}`);
  }
  return raw;
}

export function parseRecipient(recipient: string): KeyObject {
  const raw = decodeKeyBody(recipient, RECIPIENT_PREFIX, 'recipient');
  return createPublicKey({
    key: { kty: 'OKP', crv: 'X25519', x: raw.toString('base64url') },
    format: 'jwk',
  });
}

export function parseIdentity(identity: string): KeyObject {
  const raw = decodeKeyBody(identity, IDENTITY_PREFIX, 'identity');
  return createPrivateKey({
    key: Buffer.concat([PKCS8_X25519_PREFIX, raw]),
    format: 'der',
    type: 'pkcs8',
  });
}

/** The recipient an identity opens archives for — how restore reports a mismatch. */
export function recipientForIdentity(identity: string): string {
  return RECIPIENT_PREFIX + rawPublic(createPublicKey(parseIdentity(identity))).toString('base64url');
}

/** Short, stable label for a recipient, for messages and manifests. */
export function recipientFingerprint(recipient: string): string {
  const raw = decodeKeyBody(recipient, RECIPIENT_PREFIX, 'recipient');
  return createHmac('sha256', raw).update('homestead-backup-recipient-v1').digest('hex').slice(0, 16);
}

function deriveKek(shared: Buffer, ephPub: Buffer, recipientRaw: Buffer): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      shared,
      Buffer.concat([ephPub, recipientRaw]),
      Buffer.from('homestead-backup-kek:v1'),
      KEY_LEN,
    ),
  );
}

/** Nonce for body chunk `counter`; the final chunk is the only one flagged. */
function chunkNonce(counter: number, final: boolean): Buffer {
  const nonce = Buffer.alloc(NONCE_LEN);
  nonce.writeUInt32BE(Math.floor(counter / 2 ** 32), 3);
  nonce.writeUInt32BE(counter >>> 0, 7);
  nonce[NONCE_LEN - 1] = final ? 1 : 0;
  return nonce;
}

/** Build the plaintext header and the data key its body will be sealed with. */
export function sealHeader(recipient: string, meta: ArchiveMeta): { header: Buffer; dek: Buffer } {
  const recipientKey = parseRecipient(recipient);
  const recipientRaw = rawPublic(recipientKey);
  const eph = generateKeyPairSync('x25519');
  const ephPub = rawPublic(eph.publicKey);
  const shared = diffieHellman({ privateKey: eph.privateKey, publicKey: recipientKey });
  const kek = deriveKek(shared, ephPub, recipientRaw);

  const metaBytes = Buffer.from(JSON.stringify(meta), 'utf8');
  const metaLen = Buffer.alloc(2);
  metaLen.writeUInt16BE(metaBytes.length);
  const aad = Buffer.concat([
    MAGIC,
    Buffer.from([ARCHIVE_FORMAT_VERSION]),
    metaLen,
    metaBytes,
    ephPub,
  ]);

  const dek = randomBytes(KEY_LEN);
  const dekNonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv('aes-256-gcm', kek, dekNonce);
  cipher.setAAD(aad);
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  return { header: Buffer.concat([aad, dekNonce, wrapped, cipher.getAuthTag()]), dek };
}

const HEADER_FIXED_TAIL = NONCE_LEN + KEY_LEN + TAG_LEN;

/** True if these leading bytes look like an encrypted homestead archive. */
export function hasArchiveMagic(bytes: Uint8Array): boolean {
  return bytes.length >= MAGIC.length && Buffer.from(bytes.subarray(0, MAGIC.length)).equals(MAGIC);
}

/**
 * Read the plaintext header. Needs no key — this is what lets `restore` say
 * *which* backup key an archive wants before asking for one.
 */
export function readHeader(buf: Buffer): { meta: ArchiveMeta; headerLen: number } {
  if (!hasArchiveMagic(buf)) throw new ArchiveDecryptError('not an encrypted homestead archive');
  let off = MAGIC.length;
  const version = buf[off];
  off += 1;
  if (version !== ARCHIVE_FORMAT_VERSION) {
    throw new ArchiveDecryptError(
      `this archive uses encryption format ${version}, but this homestead understands ` +
        `up to ${ARCHIVE_FORMAT_VERSION} — upgrade homestead to restore it`,
    );
  }
  if (buf.length < off + 2) throw new ArchiveDecryptError('truncated archive header');
  const metaLen = buf.readUInt16BE(off);
  off += 2;
  const headerLen = off + metaLen + KEY_LEN + HEADER_FIXED_TAIL;
  if (buf.length < headerLen) throw new ArchiveDecryptError('truncated archive header');

  let meta: ArchiveMeta;
  try {
    meta = JSON.parse(buf.subarray(off, off + metaLen).toString('utf8')) as ArchiveMeta;
  } catch {
    throw new ArchiveDecryptError('archive header metadata is unreadable');
  }
  return { meta, headerLen };
}

/** Recover the data key from a header. Throws unless `identity` is the one. */
export function openHeader(buf: Buffer, identity: string): { meta: ArchiveMeta; dek: Buffer; headerLen: number } {
  const { meta, headerLen } = readHeader(buf);
  const metaLen = buf.readUInt16BE(MAGIC.length + 1);
  const ephOff = MAGIC.length + 1 + 2 + metaLen;
  const aad = buf.subarray(0, ephOff + KEY_LEN);
  const ephPub = buf.subarray(ephOff, ephOff + KEY_LEN);

  let off = ephOff + KEY_LEN;
  const dekNonce = buf.subarray(off, (off += NONCE_LEN));
  const wrapped = buf.subarray(off, (off += KEY_LEN));
  const tag = buf.subarray(off, (off += TAG_LEN));

  const privateKey = parseIdentity(identity);
  const shared = diffieHellman({
    privateKey,
    publicKey: createPublicKey({
      key: { kty: 'OKP', crv: 'X25519', x: Buffer.from(ephPub).toString('base64url') },
      format: 'jwk',
    }),
  });
  const kek = deriveKek(shared, Buffer.from(ephPub), decodeKeyBody(meta.recipient, RECIPIENT_PREFIX, 'recipient'));

  const decipher = createDecipheriv('aes-256-gcm', kek, dekNonce);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  let dek: Buffer;
  try {
    dek = Buffer.concat([decipher.update(wrapped), decipher.final()]);
  } catch {
    throw new ArchiveDecryptError(
      'could not unwrap this archive with that identity — wrong backup key, or the archive has been altered',
    );
  }
  return { meta, dek, headerLen };
}

/** Accumulates writes and hands back exactly-sized pieces, one held in reserve. */
class Chunker {
  private parts: Buffer[] = [];
  private length = 0;

  push(buf: Buffer): void {
    this.parts.push(buf);
    this.length += buf.length;
  }

  /**
   * Take one piece of `size`, but only while strictly more than `size` is
   * buffered — so a full piece is always still in hand when the input ends and
   * the last piece can be marked final.
   */
  takeNonFinal(size: number): Buffer | null {
    if (this.length <= size) return null;
    const joined = Buffer.concat(this.parts, this.length);
    const piece = joined.subarray(0, size);
    const rest = joined.subarray(size);
    this.parts = rest.length > 0 ? [rest] : [];
    this.length = rest.length;
    return piece;
  }

  drain(): Buffer {
    const joined = Buffer.concat(this.parts, this.length);
    this.parts = [];
    this.length = 0;
    return joined;
  }
}

/** Seals a plaintext stream into the archive body. */
export class EncryptBody extends Transform {
  private readonly chunker = new Chunker();
  private counter = 0;

  constructor(private readonly dek: Buffer) {
    super();
  }

  private seal(plaintext: Buffer, final: boolean): Buffer {
    const cipher = createCipheriv('aes-256-gcm', this.dek, chunkNonce(this.counter, final));
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    this.counter += 1;
    return Buffer.concat([ct, cipher.getAuthTag()]);
  }

  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    this.chunker.push(chunk);
    let piece: Buffer | null;
    while ((piece = this.chunker.takeNonFinal(CHUNK_SIZE)) !== null) {
      this.push(this.seal(piece, false));
    }
    cb();
  }

  override _flush(cb: TransformCallback): void {
    this.push(this.seal(this.chunker.drain(), true));
    cb();
  }
}

/** Opens an archive body, releasing only chunks that authenticate. */
export class DecryptBody extends Transform {
  private readonly chunker = new Chunker();
  private counter = 0;

  constructor(private readonly dek: Buffer) {
    super();
  }

  private open(frame: Buffer, final: boolean): Buffer {
    if (frame.length < TAG_LEN) {
      throw new ArchiveDecryptError('archive body is truncated');
    }
    const ct = frame.subarray(0, frame.length - TAG_LEN);
    const tag = frame.subarray(frame.length - TAG_LEN);
    const decipher = createDecipheriv('aes-256-gcm', this.dek, chunkNonce(this.counter, final));
    decipher.setAuthTag(tag);
    try {
      const out = Buffer.concat([decipher.update(ct), decipher.final()]);
      this.counter += 1;
      return out;
    } catch {
      throw new ArchiveDecryptError(
        final
          ? 'archive body failed to authenticate — it has been truncated or altered'
          : 'archive body failed to authenticate — it has been altered',
      );
    }
  }

  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    this.chunker.push(chunk);
    try {
      let frame: Buffer | null;
      while ((frame = this.chunker.takeNonFinal(FRAME_LEN)) !== null) {
        this.push(this.open(frame, false));
      }
    } catch (err) {
      cb(err as Error);
      return;
    }
    cb();
  }

  override _flush(cb: TransformCallback): void {
    try {
      this.push(this.open(this.chunker.drain(), true));
    } catch (err) {
      cb(err as Error);
      return;
    }
    cb();
  }
}
