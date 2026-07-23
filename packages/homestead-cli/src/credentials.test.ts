import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CredentialsError,
  credentialsPath,
  getProfile,
  loadCredentials,
  removeProfile,
  saveProfile,
  setDefaultProfile,
  type Profile,
} from './credentials.ts';

let dir: string;
const prevConfigDir = process.env.HOMESTEAD_CONFIG_DIR;

const profile = (over: Partial<Profile> = {}): Profile => ({
  server: 'https://home.example.com',
  token: 'tok-abc',
  email: 'me@example.com',
  userId: 'users/1',
  ...over,
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hs-creds-'));
  process.env.HOMESTEAD_CONFIG_DIR = dir;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  if (prevConfigDir === undefined) delete process.env.HOMESTEAD_CONFIG_DIR;
  else process.env.HOMESTEAD_CONFIG_DIR = prevConfigDir;
});

test('loadCredentials returns an empty store when no file exists', () => {
  expect(loadCredentials()).toEqual({ profiles: {} });
});

test('first saved profile becomes the default and the file is 0600', () => {
  saveProfile('work', profile());
  const creds = loadCredentials();
  expect(creds.default).toBe('work');
  expect(creds.profiles.work).toEqual(profile());
  // 0600 → only owner read/write.
  expect(statSync(credentialsPath()).mode & 0o777).toBe(0o600);
});

test('a second profile does not steal the default unless asked', () => {
  saveProfile('work', profile());
  saveProfile('home', profile({ server: 'http://127.0.0.1:3000' }));
  expect(loadCredentials().default).toBe('work');

  saveProfile('remote', profile(), { setDefault: true });
  expect(loadCredentials().default).toBe('remote');
});

test('getProfile resolves named, default, and sole-profile fallback', () => {
  saveProfile('work', profile());
  // named
  expect(getProfile('work')?.label).toBe('work');
  // default pointer
  expect(getProfile()?.label).toBe('work');
  // unknown
  expect(getProfile('nope')).toBeUndefined();
});

test('getProfile with no default and one profile falls back to it', () => {
  // Write a store with a profile but no default pointer.
  writeFileSync(
    credentialsPath(),
    JSON.stringify({ profiles: { only: profile() } }),
  );
  expect(getProfile()?.label).toBe('only');
});

test('setDefaultProfile repoints; unknown label throws', () => {
  saveProfile('work', profile());
  saveProfile('home', profile());
  setDefaultProfile('home');
  expect(loadCredentials().default).toBe('home');
  expect(() => setDefaultProfile('ghost')).toThrow(CredentialsError);
});

test('removeProfile drops the profile and repoints a stale default', () => {
  saveProfile('work', profile());
  saveProfile('home', profile());
  expect(loadCredentials().default).toBe('work');

  removeProfile('work');
  const creds = loadCredentials();
  expect(creds.profiles.work).toBeUndefined();
  expect(creds.default).toBe('home');

  removeProfile('home');
  expect(loadCredentials().default).toBeUndefined();
  expect(existsSync(credentialsPath())).toBe(true);
});

describe('malformed files', () => {
  test('non-JSON throws CredentialsError', () => {
    writeFileSync(credentialsPath(), 'not json');
    expect(() => loadCredentials()).toThrow(CredentialsError);
  });

  test('missing profiles map throws CredentialsError', () => {
    writeFileSync(credentialsPath(), JSON.stringify({ default: 'x' }));
    expect(() => loadCredentials()).toThrow(CredentialsError);
  });
});
