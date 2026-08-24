/**
 * `homestead backup-key` — the keypair that encrypts backup archives.
 *
 * Deliberately asymmetric, and deliberately lopsided about where the halves
 * live. `generate` prints the private identity to the terminal and writes only
 * the *public* recipient to disk, so the default state of a homestead box is:
 * it can write encrypted backups, and it cannot read them back. That is the
 * whole point — a stolen machine (or a scheduled backup that would otherwise
 * need a secret sitting next to the data) yields ciphertext.
 *
 * The trade is real and worth stating plainly: nothing on the machine can
 * recover the identity. Lose it and every archive it was written for is gone.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  generateBackupKeypair,
  recipientFingerprint,
  recipientForIdentity,
} from './archive-crypto.ts';


/**
 * Test override for the two default paths. Without it a suite run would consult
 * the developer's real home directory and behave differently depending on
 * whether they happen to have a backup key — the same reason
 * `engine/crypto.ts` carries one.
 */
let defaultPathsOverride: { recipient: string; identity: string } | undefined;

export function __setDefaultBackupKeyPathsForTests(
  paths: { recipient: string; identity: string } | undefined,
): void {
  defaultPathsOverride = paths;
}

/** Where the public recipient lives by default — safe to keep on the box. */
export function defaultRecipientPath(): string {
  return defaultPathsOverride?.recipient ?? join(homedir(), '.homestead', 'backup-recipient.pub');
}

/**
 * Where an identity is looked for by default. Nothing writes here unless the
 * operator explicitly asks (`generate --out`); it exists so a deliberate
 * same-box setup, or a restore that stages the key there, is convenient.
 */
export function defaultIdentityPath(): string {
  return defaultPathsOverride?.identity ?? join(homedir(), '.homestead', 'backup.key');
}

export interface RecipientLocation {
  source: 'flag' | 'file' | 'env' | 'default-file' | 'none';
  path?: string;
  value?: string;
}

/**
 * Resolve the recipient `homestead backup` should encrypt to, in precedence
 * order. Finding one turns archive encryption on, mirroring how a master key
 * turns encryption at rest on — no extra flag to remember.
 */
export function resolveRecipient(opts: { recipient?: string; recipientFile?: string } = {}): RecipientLocation {
  if (opts.recipient) return { source: 'flag', value: opts.recipient.trim() };
  if (opts.recipientFile) {
    return {
      source: 'file',
      path: opts.recipientFile,
      value: existsSync(opts.recipientFile)
        ? readFileSync(opts.recipientFile, 'utf8').trim()
        : undefined,
    };
  }
  const env = process.env.HOMESTEAD_BACKUP_RECIPIENT;
  if (env) return { source: 'env', value: env.trim() };

  const def = defaultRecipientPath();
  if (existsSync(def)) {
    return { source: 'default-file', path: def, value: readFileSync(def, 'utf8').trim() };
  }
  return { source: 'none' };
}

export interface IdentityLocation {
  source: 'flag' | 'env' | 'default-file' | 'none';
  path?: string;
  value?: string;
}

/**
 * Resolve the identity `homestead restore` should open an archive with.
 * `--identity` may be the key itself or a path to it, because both are things
 * an operator plausibly has to hand when restoring.
 */
export function resolveIdentity(opts: { identity?: string } = {}): IdentityLocation {
  if (opts.identity) {
    const given = opts.identity.trim();
    if (given.startsWith('hsbk1sk_')) return { source: 'flag', value: given };
    if (!existsSync(given)) return { source: 'flag', path: given };
    return { source: 'flag', path: given, value: readFileSync(given, 'utf8').trim() };
  }
  const env = process.env.HOMESTEAD_BACKUP_IDENTITY;
  if (env) {
    const value = env.trim();
    if (value.startsWith('hsbk1sk_')) return { source: 'env', value };
    return {
      source: 'env',
      path: value,
      value: existsSync(value) ? readFileSync(value, 'utf8').trim() : undefined,
    };
  }
  const def = defaultIdentityPath();
  if (existsSync(def)) {
    return { source: 'default-file', path: def, value: readFileSync(def, 'utf8').trim() };
  }
  return { source: 'none' };
}

/** `homestead backup-key generate` — mint a backup keypair. */
export function generateBackupKeyCmd(opts: {
  recipientFile?: string;
  out?: string;
  force?: boolean;
}): number {
  const recipientPath = opts.recipientFile ?? defaultRecipientPath();
  if (existsSync(recipientPath) && !opts.force) {
    console.error(
      `refusing to overwrite the existing backup recipient at ${recipientPath}\n` +
        'Archives already written for it could only be restored with its identity.\n' +
        'Pass --force if you mean to start encrypting to a new key.',
    );
    return 1;
  }
  if (opts.out && existsSync(opts.out) && !opts.force) {
    console.error(`refusing to overwrite the existing identity at ${opts.out} (pass --force)`);
    return 1;
  }

  const { identity, recipient } = generateBackupKeypair();
  mkdirSync(dirname(recipientPath), { recursive: true });
  writeFileSync(recipientPath, `${recipient}\n`, { mode: 0o644 });

  console.log('Backup identity (SECRET — this is the only copy):');
  console.log('');
  console.log(`  ${identity}`);
  console.log('');
  console.log('  ⚠  STORE THIS SOMEWHERE OFF THIS MACHINE, NOW — a password manager or');
  console.log('     a secrets store. It is the only thing that can open the archives this');
  console.log('     box writes, and nothing here can regenerate it. Lose it and every');
  console.log('     backup encrypted to it is unreadable, permanently.');
  console.log('');
  console.log(`Recipient (public, safe to keep here): ${recipient}`);
  console.log(`  written to ${recipientPath}`);
  console.log(`  fingerprint ${recipientFingerprint(recipient)}`);
  console.log('');

  if (opts.out) {
    mkdirSync(dirname(opts.out), { recursive: true });
    writeFileSync(opts.out, `${identity}\n`, { mode: 0o600 });
    chmodSync(opts.out, 0o600);
    console.log(`The identity was also written to ${opts.out} (mode 0600).`);
    console.log('  Note this puts the secret on the machine being backed up, so a thief who');
    console.log('  takes the box can read its archives. Keep it only if you need');
    console.log('  same-box restores without fetching the key.');
    console.log('');
  }

  console.log('`homestead backup` will now encrypt every archive to this recipient.');
  console.log('Prove the pair works before you rely on it:');
  console.log('');
  console.log('  homestead backup');
  console.log('  homestead restore --from=<archive> --verify --identity=<the identity above>');
  return 0;
}

/** `homestead backup-key show` — print the recipient (or, on request, the identity). */
export function showBackupKeyCmd(opts: { recipientFile?: string; identity?: boolean }): number {
  if (opts.identity) {
    const loc = resolveIdentity({});
    if (!loc.value) {
      console.error(
        'no backup identity configured (checked HOMESTEAD_BACKUP_IDENTITY and ' +
          `${defaultIdentityPath()}).\nThe identity is normally kept off this machine — ` +
          'fetch it from wherever you stored it.',
      );
      return 1;
    }
    process.stdout.write(`${loc.value}\n`);
    return 0;
  }

  const loc = resolveRecipient({ recipientFile: opts.recipientFile });
  if (loc.source === 'none' || !loc.value) {
    console.error(
      'no backup recipient configured (checked HOMESTEAD_BACKUP_RECIPIENT and ' +
        `${defaultRecipientPath()}).\nRun \`homestead backup-key generate\` to create one.`,
    );
    return 1;
  }
  process.stdout.write(`${loc.value}\n`);
  return 0;
}
