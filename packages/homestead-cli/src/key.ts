/**
 * Master-key tooling for encryption-at-rest.
 *
 * The server reads a 32-byte master key from HOMESTEAD_MASTER_KEY (base64) or
 * HOMESTEAD_MASTER_KEY_FILE (a path). These commands generate and reveal that
 * key. The key must live OUTSIDE the data directory (and out of backups), so
 * `key generate` writes it under ~/.homestead by default and `doctor` flags a
 * key that sits inside the data dir.
 */

import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Default on-disk location for the master key (outside any project/data dir). */
export function defaultKeyPath(): string {
  return join(homedir(), '.homestead', 'master.key');
}

export interface KeyLocation {
  /** Where the key came from. */
  source: 'env' | 'file' | 'default-file' | 'none';
  /** Path, when the key is file-backed. */
  path?: string;
  /** The base64 key value, when resolvable. */
  value?: string;
}

/**
 * Resolve the key the server would use, in the same precedence order:
 * inline env var, explicit key file, then the default key file if present.
 */
export function resolveKeyLocation(): KeyLocation {
  const inline = process.env.HOMESTEAD_MASTER_KEY;
  if (inline) return { source: 'env', value: inline.trim() };

  const file = process.env.HOMESTEAD_MASTER_KEY_FILE;
  if (file) {
    return {
      source: 'file',
      path: file,
      value: existsSync(file) ? readFileSync(file, 'utf8').trim() : undefined,
    };
  }

  const def = defaultKeyPath();
  if (existsSync(def)) {
    return { source: 'default-file', path: def, value: readFileSync(def, 'utf8').trim() };
  }
  return { source: 'none' };
}

/** `homestead key generate` — write a fresh master key, refusing to clobber. */
export function generateKeyCmd(opts: { file?: string; force?: boolean }): number {
  const path = opts.file ?? defaultKeyPath();
  if (existsSync(path) && !opts.force) {
    console.error(
      `refusing to overwrite existing key at ${path}\n` +
        'A new key cannot decrypt data written under the old one. Pass --force only\n' +
        'if you are sure nothing is encrypted with it.',
    );
    return 1;
  }

  const key = randomBytes(32).toString('base64');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${key}\n`, { mode: 0o600 });
  chmodSync(path, 0o600); // enforce perms even if the file pre-existed

  console.log(`wrote a new 32-byte master key to ${path} (mode 0600)`);
  console.log('');
  console.log('  ⚠  BACK THIS UP NOW, somewhere separate from your data/backups.');
  console.log('     If you lose it, encrypted files and text become unrecoverable.');
  console.log('');
  console.log('  Point the server at it by setting, in your environment or .env:');
  console.log(`     HOMESTEAD_MASTER_KEY_FILE=${path}`);
  console.log('');
  console.log('  Encryption turns on for new writes once the server sees the key.');
  return 0;
}

/** `homestead key show` — print the resolved key (for stashing in a manager). */
export function showKeyCmd(opts: { file?: string }): number {
  if (opts.file) {
    if (!existsSync(opts.file)) {
      console.error(`no key file at ${opts.file}`);
      return 1;
    }
    process.stdout.write(`${readFileSync(opts.file, 'utf8').trim()}\n`);
    return 0;
  }

  const loc = resolveKeyLocation();
  if (loc.source === 'none' || !loc.value) {
    console.error(
      'no master key configured (checked HOMESTEAD_MASTER_KEY, HOMESTEAD_MASTER_KEY_FILE, and ' +
        `${defaultKeyPath()}).\nRun \`homestead key generate\` to create one.`,
    );
    return 1;
  }
  process.stdout.write(`${loc.value}\n`);
  return 0;
}

/** Whether a key file's permissions are tighter than group/other access. */
export function keyPermsAreLocked(path: string): boolean {
  try {
    return (statSync(path).mode & 0o077) === 0;
  } catch {
    return false;
  }
}
