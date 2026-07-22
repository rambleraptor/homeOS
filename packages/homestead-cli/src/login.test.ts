import { afterEach, beforeEach, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { login, logout, normalizeServer } from './login.ts';
import { getProfile, loadCredentials, saveProfile } from './credentials.ts';

// These tests run under both Vitest and Bun's `bun test`, so we avoid the
// Vitest-only mocking helpers (vi.stubGlobal/spyOn) and swap globals by hand.

let dir: string;
const prevConfigDir = process.env.HOMESTEAD_CONFIG_DIR;
const realFetch = globalThis.fetch;
const realLog = console.log;
const realError = console.error;
let logs: string[];
let errors: string[];

type FetchCall = { url: string; init?: RequestInit };

/** Install a fetch stub that records calls and returns `responder(call)`. */
function stubFetch(responder: (call: FetchCall) => Response): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return responder(call);
  }) as typeof fetch;
  return calls;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hs-login-'));
  process.env.HOMESTEAD_CONFIG_DIR = dir;
  logs = [];
  errors = [];
  console.log = (...a: unknown[]) => logs.push(a.join(' '));
  console.error = (...a: unknown[]) => errors.push(a.join(' '));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  if (prevConfigDir === undefined) delete process.env.HOMESTEAD_CONFIG_DIR;
  else process.env.HOMESTEAD_CONFIG_DIR = prevConfigDir;
  globalThis.fetch = realFetch;
  console.log = realLog;
  console.error = realError;
});

test('normalizeServer strips trailing slash and /api/aep', () => {
  expect(normalizeServer('https://home.example.com/')).toBe('https://home.example.com');
  expect(normalizeServer('https://home.example.com/api/aep')).toBe('https://home.example.com');
  expect(normalizeServer('  http://127.0.0.1:3000/api/aep/  ')).toBe('http://127.0.0.1:3000');
});

test('non-interactive login requires --server/--email/--password', async () => {
  expect(await login({ email: 'a@b.com', password: 'pw' })).toBe(1); // no server
  expect(await login({ server: 'http://x', password: 'pw' })).toBe(1); // no email
  expect(await login({ server: 'http://x', email: 'a@b.com' })).toBe(1); // no password
  expect(errors.length).toBeGreaterThan(0);
});

test('successful login POSTs :login and saves a default profile', async () => {
  const calls = stubFetch(
    () =>
      new Response(JSON.stringify({ token: 'tok-xyz', user: { id: 'users/7' } }), { status: 200 }),
  );

  // A trailing /api/aep on the input should be normalized away.
  const code = await login({
    server: 'https://home.example.com/api/aep',
    email: 'me@b.com',
    password: 'pw',
  });

  expect(code).toBe(0);
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toBe('https://home.example.com/api/aep/users/:login');
  expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ email: 'me@b.com', password: 'pw' });

  expect(getProfile('default')?.profile).toEqual({
    server: 'https://home.example.com',
    token: 'tok-xyz',
    email: 'me@b.com',
    userId: 'users/7',
  });
  expect(loadCredentials().default).toBe('default');
});

test('login under a named profile does not steal an existing default', async () => {
  saveProfile('work', { server: 'https://work', token: 't', email: 'w@w.com', userId: 'users/1' });
  stubFetch(
    () => new Response(JSON.stringify({ token: 't2', user: { id: 'users/2' } }), { status: 200 }),
  );

  await login({ server: 'https://home', email: 'h@h.com', password: 'pw', profile: 'home' });

  const creds = loadCredentials();
  expect(creds.default).toBe('work'); // unchanged
  expect(creds.profiles.home?.token).toBe('t2');
});

test('bad credentials surface a friendly 401 message and save nothing', async () => {
  stubFetch(() => new Response('nope', { status: 401 }));

  const code = await login({ server: 'http://x', email: 'a@b.com', password: 'bad' });

  expect(code).toBe(1);
  expect(errors).toContain('invalid email or password');
  expect(loadCredentials().profiles).toEqual({});
});

test('logout removes the profile even when the revoke call fails', async () => {
  saveProfile('work', { server: 'https://work', token: 'tok', email: 'w@w.com', userId: 'users/1' });
  globalThis.fetch = (async () => {
    throw new Error('connection refused');
  }) as typeof fetch;

  const code = await logout({ profile: 'work' });

  expect(code).toBe(0);
  expect(loadCredentials().profiles.work).toBeUndefined();
});
