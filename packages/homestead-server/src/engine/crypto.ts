/**
 * Encryption-at-rest for file bytes and extracted-text fields.
 *
 * Trust model: the server is trusted to decrypt. A single 32-byte master key
 * lives either in the instance environment or in a key file outside the data
 * directory (never in the database or a backup). File bytes and the
 * extracted-text companion columns are stored
 * as ciphertext so that a stolen disk, database, or backup is unreadable
 * without that key. It does NOT protect data from a compromised running
 * server or the operator — that is out of scope by design.
 *
 * Envelope scheme, per encrypted item:
 *   1. a fresh random 32-byte data-encryption key (DEK) encrypts the bytes
 *      with AES-256-GCM;
 *   2. a per-item key-encryption key (KEK), derived from the master key and a
 *      stable key id (the resource path), wraps the DEK with AES-256-GCM.
 * The wrapped DEK travels next to the ciphertext in a self-describing
 * container, so rotating the master key later only has to re-wrap DEKs. Keying
 * the KEK on the resource path gives per-resource isolation: a leaked KEK
 * exposes one resource's data, not the whole instance.
 *
 * Two on-the-wire forms share one container:
 *   - binary (file bytes on disk) — raw container, prefixed with a magic tag;
 *   - text (a DB string column)   — the container base64-encoded behind a
 *     human-readable `enc:v1:` prefix that doubles as the in-DB flag.
 *
 * The authoritative "is this encrypted?" signal is a DB marker written by the
 * caller (see FILE_MARKER_* / TEXT_PREFIX); the container magic is only a
 * secondary cross-check. Anything that cannot be decrypted fails closed —
 * we never hand back ciphertext as if it were content.
 *
 * Uses only `node:crypto` (available under both Bun and Node) — no Bun-only
 * APIs, per the repo's runtime-seam rules.
 */

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Format version, bumped if the container layout ever changes. */
export const FORMAT_VERSION = 1;

/** DB column value for a file field whose on-disk bytes are plaintext (legacy). */
export const FILE_MARKER_PLAINTEXT = '1';
/** DB column value for a file field whose on-disk bytes are encrypted. */
export const FILE_MARKER_ENCRYPTED = 'enc:v1';
/** Prefix on an encrypted text column value; also the in-DB "encrypted" flag. */
export const TEXT_PREFIX = 'enc:v1:';

/** Magic tag at the head of a binary container, for the secondary cross-check. */
const MAGIC = Buffer.from('HSENC1', 'ascii'); // 6 bytes
const DEK_LEN = 32; // AES-256 key
const NONCE_LEN = 12; // GCM nonce
const TAG_LEN = 16; // GCM tag

/** Thrown when encrypted data is present but no usable master key is configured. */
export class MissingMasterKeyError extends Error {
  constructor(message = 'encrypted data present but no master key configured') {
    super(message);
    this.name = 'MissingMasterKeyError';
  }
}

/** Thrown when a container cannot be authenticated/decrypted (tamper, wrong key). */
export class DecryptError extends Error {
  constructor(message = 'failed to decrypt: data is corrupt or the master key is wrong') {
    super(message);
    this.name = 'DecryptError';
  }
}

let cachedKey: Buffer | null = null;
let cachedFrom: string | null = null;

/**
 * Where `homestead key generate` writes the master key by default, kept in
 * lockstep with the CLI's `defaultKeyPath()`. Resolving it here lets an
 * operator turn encryption on with just `homestead key generate` + a restart —
 * no environment editing. A test override (see `__setDefaultKeyPathForTests`)
 * keeps the suite from ever reading a real key out of the developer's home dir.
 */
let defaultKeyPathOverride: string | null | undefined;
function defaultMasterKeyPath(): string | null {
  if (defaultKeyPathOverride !== undefined) return defaultKeyPathOverride;
  return join(homedir(), '.homestead', 'master.key');
}

/**
 * Resolve the master key, in the same precedence order the CLI reports:
 * `HOMESTEAD_MASTER_KEY` (base64 inline) → `HOMESTEAD_MASTER_KEY_FILE` (a path)
 * → the default key file (`~/.homestead/master.key`) if it exists. Returns null
 * when none of those yields a key (encryption disabled). An explicitly
 * configured file that can't be read is an error (the operator meant to use
 * it); a merely-absent default file just means encryption is off.
 */
function resolveMasterKey(): Buffer | null {
  const inline = process.env.HOMESTEAD_MASTER_KEY;
  const envFile = process.env.HOMESTEAD_MASTER_KEY_FILE;

  let source: string;
  let readPath: string | null = null;
  if (inline) {
    source = `inline:${inline}`;
  } else if (envFile) {
    source = `file:${envFile}`;
    readPath = envFile;
  } else {
    const def = defaultMasterKeyPath();
    if (!def || !existsSync(def)) {
      cachedKey = null;
      cachedFrom = null;
      return null;
    }
    source = `default-file:${def}`;
    readPath = def;
  }
  if (source === cachedFrom && cachedKey) return cachedKey;

  let raw: string;
  if (inline) {
    raw = inline;
  } else {
    try {
      raw = readFileSync(readPath as string, 'utf8');
    } catch (err) {
      throw new MissingMasterKeyError(
        `cannot read master key file (${readPath}): ${(err as Error).message}`,
      );
    }
  }

  const key = Buffer.from(raw.trim(), 'base64');
  if (key.length !== DEK_LEN) {
    throw new MissingMasterKeyError(
      `master key must be ${DEK_LEN} bytes base64-encoded, got ${key.length} bytes`,
    );
  }
  cachedKey = key;
  cachedFrom = source;
  return key;
}

/** True when a master key is configured (i.e. new writes should be encrypted). */
export function encryptionEnabled(): boolean {
  return resolveMasterKey() !== null;
}

/** Master key, or throw MissingMasterKeyError if none is configured. */
function requireMasterKey(): Buffer {
  const key = resolveMasterKey();
  if (!key) throw new MissingMasterKeyError();
  return key;
}

/**
 * Per-item key-encryption key. HMAC-SHA256 over the master key with a
 * key-id-scoped label — one HMAC is HKDF-Expand with L=32 and, since the master
 * key is already uniformly random, a sound KDF here. Deterministic, so the
 * same key id always derives the same KEK for wrap and unwrap.
 */
function deriveKek(masterKey: Buffer, keyId: string): Buffer {
  return createHmac('sha256', masterKey).update(`homestead-kek:v1:${keyId}`).digest();
}

function gcmEncrypt(key: Buffer, plaintext: Buffer): { nonce: Buffer; ct: Buffer; tag: Buffer } {
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { nonce, ct, tag: cipher.getAuthTag() };
}

function gcmDecrypt(key: Buffer, nonce: Buffer, ct: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * Encrypt bytes into a self-describing binary container, wrapping the DEK with
 * the KEK derived for `keyId`. Requires a configured master key.
 */
export function encryptBytes(plaintext: Uint8Array, keyId: string): Buffer {
  const kek = deriveKek(requireMasterKey(), keyId);
  const dek = randomBytes(DEK_LEN);
  const wrapped = gcmEncrypt(kek, dek);
  const data = gcmEncrypt(dek, Buffer.from(plaintext));
  // MAGIC | version | dekNonce | wrappedDek | dekTag | dataNonce | dataTag | ciphertext
  return Buffer.concat([
    MAGIC,
    Buffer.from([FORMAT_VERSION]),
    wrapped.nonce,
    wrapped.ct,
    wrapped.tag,
    data.nonce,
    data.tag,
    data.ct,
  ]);
}

/** True if `bytes` starts with the container magic tag. */
export function isEncryptedContainer(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC.length) return false;
  return Buffer.from(bytes.subarray(0, MAGIC.length)).equals(MAGIC);
}

/**
 * Decrypt a binary container produced by {@link encryptBytes}. Throws
 * DecryptError on any malformed/tampered input or authentication failure, and
 * MissingMasterKeyError if no key is configured — never returns partial data.
 */
export function decryptBytes(container: Uint8Array, keyId: string): Buffer {
  if (!isEncryptedContainer(container)) {
    throw new DecryptError('not an encrypted container (bad magic)');
  }
  const buf = Buffer.from(container);
  let off = MAGIC.length;
  const version = buf[off];
  off += 1;
  if (version !== FORMAT_VERSION) {
    throw new DecryptError(`unsupported container version ${version}`);
  }
  const need = off + NONCE_LEN + DEK_LEN + TAG_LEN + NONCE_LEN + TAG_LEN;
  if (buf.length < need) throw new DecryptError('truncated container');

  const dekNonce = buf.subarray(off, (off += NONCE_LEN));
  const wrappedDek = buf.subarray(off, (off += DEK_LEN));
  const dekTag = buf.subarray(off, (off += TAG_LEN));
  const dataNonce = buf.subarray(off, (off += NONCE_LEN));
  const dataTag = buf.subarray(off, (off += TAG_LEN));
  const ciphertext = buf.subarray(off);

  const kek = deriveKek(requireMasterKey(), keyId);
  try {
    const dek = gcmDecrypt(kek, dekNonce, wrappedDek, dekTag);
    return gcmDecrypt(dek, dataNonce, ciphertext, dataTag);
  } catch (err) {
    throw new DecryptError(`failed to decrypt: ${(err as Error).message}`);
  }
}

/** True if a stored text value carries the encrypted prefix. */
export function isEncryptedText(value: string): boolean {
  return value.startsWith(TEXT_PREFIX);
}

/**
 * Encrypt a text value into the `enc:v1:<base64>` form used for DB columns.
 * Requires a configured master key.
 */
export function encryptText(plaintext: string, keyId: string): string {
  const container = encryptBytes(Buffer.from(plaintext, 'utf8'), keyId);
  return TEXT_PREFIX + container.toString('base64');
}

/**
 * Decrypt a text value. Legacy plaintext (no prefix) is returned unchanged, so
 * mixed plaintext/ciphertext rows coexist during lazy migration.
 */
export function decryptText(value: string, keyId: string): string {
  if (!isEncryptedText(value)) return value;
  const container = Buffer.from(value.slice(TEXT_PREFIX.length), 'base64');
  return decryptBytes(container, keyId).toString('utf8');
}

/** Test-only: drop the cached master key so a test can change the env. */
export function __resetMasterKeyCacheForTests(): void {
  cachedKey = null;
  cachedFrom = null;
}

/**
 * Test-only: override the default key path (`~/.homestead/master.key`). Pass a
 * path to point the fallback at a fixture, or `null` to disable the fallback so
 * "no env var" reliably means encryption-off regardless of the host's home dir.
 */
export function __setDefaultKeyPathForTests(path: string | null): void {
  defaultKeyPathOverride = path;
  __resetMasterKeyCacheForTests();
}
