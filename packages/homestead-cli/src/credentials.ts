/**
 * Persistent login profiles for the CLI. `homestead login` writes a bearer
 * token per named profile here; `homestead resources` (and any future remote
 * command) reads them back. Stored at `~/.homestead/credentials.json`
 * (overridable via `HOMESTEAD_CONFIG_DIR` for tests), dir 0700 / file 0600 so
 * the token never leaks to other users on the box.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** The label used when `homestead login` is run without `--profile`. */
export const DEFAULT_PROFILE_LABEL = 'default';

/** One saved login: a server origin plus the bearer token it minted. */
export interface Profile {
  /** App origin, e.g. `https://home.example.com` (no trailing `/api/aep`). */
  server: string;
  /** Bearer token from `POST /users/:login`. */
  token: string;
  /** The account this token belongs to, for display. */
  email?: string;
  /** The caller's user id (sent as `X-User-Id` to the custom-method gateway). */
  userId: string;
}

/** The whole credentials file: a profile map plus a repointable default. */
export interface Credentials {
  /** Label of the profile used when a command omits `--profile`. */
  default?: string;
  profiles: Record<string, Profile>;
}

/** A malformed or unreadable credentials file — distinct from "no file yet". */
export class CredentialsError extends Error {}

/** Root config dir (`~/.homestead`), overridable via `HOMESTEAD_CONFIG_DIR`. */
export function configDir(): string {
  return process.env.HOMESTEAD_CONFIG_DIR || join(homedir(), '.homestead');
}

/** Absolute path to the credentials file. */
export function credentialsPath(): string {
  return join(configDir(), 'credentials.json');
}

/** Read the credentials file, or an empty store when it doesn't exist yet. */
export function loadCredentials(): Credentials {
  const path = credentialsPath();
  if (!existsSync(path)) return { profiles: {} };
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new CredentialsError(`cannot read ${path}: ${(err as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CredentialsError(`${path} is not valid JSON — fix or delete it`);
  }
  const creds = parsed as Credentials;
  if (!creds || typeof creds !== 'object' || typeof creds.profiles !== 'object') {
    throw new CredentialsError(`${path} is malformed — fix or delete it`);
  }
  return { default: creds.default, profiles: creds.profiles ?? {} };
}

/** Persist the store, creating `~/.homestead` (0700) and the file (0600). */
export function saveCredentials(creds: Credentials): void {
  const path = credentialsPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(creds, null, 2)}\n`, { mode: 0o600 });
}

/**
 * Resolve a profile by label, or the default profile when no label is given.
 * With no label and no default set, falls back to the sole profile if there's
 * exactly one. Returns `undefined` when nothing matches.
 */
export function getProfile(
  label?: string,
): { label: string; profile: Profile } | undefined {
  const creds = loadCredentials();
  if (label) {
    const profile = creds.profiles[label];
    return profile ? { label, profile } : undefined;
  }
  const chosen = creds.default;
  if (chosen && creds.profiles[chosen]) {
    return { label: chosen, profile: creds.profiles[chosen] };
  }
  const labels = Object.keys(creds.profiles);
  if (labels.length === 1) {
    return { label: labels[0]!, profile: creds.profiles[labels[0]!]! };
  }
  return undefined;
}

/**
 * Upsert a profile. Becomes the default when `setDefault` is passed or when no
 * default exists yet (so the first login is usable with no `--profile`).
 */
export function saveProfile(
  label: string,
  profile: Profile,
  opts: { setDefault?: boolean } = {},
): void {
  const creds = loadCredentials();
  creds.profiles[label] = profile;
  if (opts.setDefault || !creds.default) creds.default = label;
  saveCredentials(creds);
}

/** Repoint the default pointer at an existing profile. */
export function setDefaultProfile(label: string): void {
  const creds = loadCredentials();
  if (!creds.profiles[label]) {
    throw new CredentialsError(`no such profile "${label}"`);
  }
  creds.default = label;
  saveCredentials(creds);
}

/**
 * Drop a profile. If it was the default, the pointer moves to a remaining
 * profile (or clears when none are left).
 */
export function removeProfile(label: string): void {
  const creds = loadCredentials();
  if (!creds.profiles[label]) {
    throw new CredentialsError(`no such profile "${label}"`);
  }
  delete creds.profiles[label];
  if (creds.default === label) {
    creds.default = Object.keys(creds.profiles)[0];
  }
  saveCredentials(creds);
}
