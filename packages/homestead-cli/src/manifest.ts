/**
 * The manifest `homestead backup` writes into every archive, and the checks
 * `homestead restore` runs against it.
 *
 * Without it an archive is an anonymous tarball: nothing says which instance
 * or release produced it, whether its bytes are intact, or — the expensive one
 * — which master key decrypts its file bytes. Restore an archive under the
 * wrong key and encrypted files come back as undecryptable garbage rather than
 * a clear error, and `homestead key generate --force` makes that a real
 * possibility.
 *
 * The key is identified by an HMAC over a fixed label, never by the key
 * itself: the manifest travels inside the archive, so it must not leak the
 * secret the archive is protected by.
 */

import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, sep } from 'node:path';

/** Archive-root filename holding the manifest. */
export const MANIFEST_NAME = 'homestead-backup.json';

/** Bumped only for a breaking manifest layout change. */
export const MANIFEST_FORMAT = 1;

export interface ManifestFile {
  /** Path as it appears in the archive, using forward slashes. */
  path: string;
  bytes: number;
  sha256: string;
}

export interface BackupManifest {
  format: number;
  created_at: string;
  homestead_version: string;
  /** Basename of the data dir this came from, for the restore summary. */
  data_dir_name: string;
  /** Whether encryption at rest was on, and which key was in force. */
  encryption: { enabled: boolean; key_id?: string };
  /** Archive members that are `VACUUM INTO` database snapshots. */
  databases: string[];
  files: ManifestFile[];
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * Hash `entries` (files or directories) under `root`, returning one record per
 * regular file with archive-relative paths.
 *
 * Symlinks and other non-regular entries are skipped: tar stores a symlink as a
 * link rather than its target's bytes, so hashing the target would report a
 * false mismatch on every restore. The engine only ever writes regular files.
 */
export function listFiles(root: string, entries: string[]): string[] {
  const out: string[] = [];
  const walk = (relative: string): void => {
    const absolute = join(root, relative);
    // lstat, not stat: a symlink must read as a symlink so the walk neither
    // follows it nor hashes its target's bytes.
    const stats = lstatSync(absolute, { throwIfNoEntry: false });
    if (!stats) return;
    if (stats.isDirectory()) {
      for (const child of readdirSync(absolute).sort()) walk(join(relative, child));
      return;
    }
    if (!stats.isFile()) return; // symlink, socket, fifo — see above
    out.push(relative.split(sep).join(posix.sep));
  };
  for (const entry of entries) walk(entry);
  return out.sort();
}

export function hashEntries(root: string, entries: string[]): ManifestFile[] {
  return listFiles(root, entries).map((path) => {
    const absolute = join(root, ...path.split(posix.sep));
    return { path, bytes: statSync(absolute).size, sha256: sha256File(absolute) };
  });
}

export function writeManifest(path: string, manifest: BackupManifest): void {
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Parse a manifest, rejecting anything this release can't interpret. Returns a
 * message instead of throwing so callers can report and exit cleanly.
 */
export function readManifest(path: string): BackupManifest | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return { error: `${MANIFEST_NAME} is not readable JSON: ${(err as Error).message}` };
  }
  const m = parsed as Partial<BackupManifest>;
  if (typeof m?.format !== 'number' || !Array.isArray(m.files)) {
    return { error: `${MANIFEST_NAME} is missing required fields` };
  }
  if (m.format > MANIFEST_FORMAT) {
    return {
      error:
        `this archive uses backup format ${m.format}, but this homestead understands ` +
        `up to ${MANIFEST_FORMAT} — upgrade homestead to restore it`,
    };
  }
  return {
    format: m.format,
    created_at: m.created_at ?? 'unknown',
    homestead_version: m.homestead_version ?? 'unknown',
    data_dir_name: m.data_dir_name ?? 'data',
    encryption: m.encryption ?? { enabled: false },
    databases: m.databases ?? [],
    files: m.files,
  };
}

/**
 * Compare an extracted archive against its manifest. Returns a list of
 * human-readable problems — empty means every listed file is present at the
 * recorded size and digest.
 *
 * Files present but unlisted are reported separately as `extra`: they are not
 * corruption, just something the manifest can't vouch for.
 */
export function verifyExtracted(
  root: string,
  manifest: BackupManifest,
): { problems: string[]; extra: string[] } {
  const problems: string[] = [];
  for (const file of manifest.files) {
    const absolute = join(root, ...file.path.split(posix.sep));
    const stats = lstatSync(absolute, { throwIfNoEntry: false });
    if (!stats?.isFile()) {
      problems.push(`${file.path}: listed in the manifest but missing from the archive`);
      continue;
    }
    if (stats.size !== file.bytes) {
      problems.push(`${file.path}: expected ${file.bytes} bytes, found ${stats.size}`);
      continue;
    }
    if (sha256File(absolute) !== file.sha256) {
      problems.push(`${file.path}: contents do not match the recorded checksum`);
    }
  }

  const listed = new Set(manifest.files.map((f) => f.path));
  listed.add(MANIFEST_NAME);
  const extra = listFiles(root, readdirSync(root)).filter((p) => !listed.has(p));
  return { problems, extra };
}
