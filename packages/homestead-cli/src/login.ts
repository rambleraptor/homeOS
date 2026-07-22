/**
 * `homestead login` / `logout` / `profiles` — authenticate the CLI against a
 * (possibly remote) Homestead server and persist a bearer token per named
 * profile. The token is a normal user token from `POST /users/:login`, so the
 * CLI acts with exactly the access that account has — no magic superuser mint.
 */

import { createInterface } from 'node:readline/promises';
import {
  DEFAULT_PROFILE_LABEL,
  getProfile,
  loadCredentials,
  removeProfile,
  saveProfile,
  setDefaultProfile,
  type Profile,
} from './credentials.ts';

export interface LoginOptions {
  /** Server origin or engine URL; a trailing `/api/aep` is tolerated. */
  server?: string;
  email?: string;
  password?: string;
  /** Profile label to write (default `default`). */
  profile?: string;
  /** Force this profile to become the default even if one already exists. */
  setDefault?: boolean;
}

/**
 * Normalize a user-supplied server value to a bare origin: trim, drop a
 * trailing slash and an optional `/api/aep` suffix. Exported for tests.
 */
export function normalizeServer(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/api\/aep$/, '');
}

/** POST /users/:login → { token, userId }. Throws with a friendly message. */
async function postLogin(
  origin: string,
  email: string,
  password: string,
): Promise<{ token: string; userId: string }> {
  let res: Response;
  try {
    res = await fetch(`${origin}/api/aep/users/:login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(`cannot reach ${origin} — is the server running and the URL correct?`);
  }
  if (res.status === 401) throw new Error('invalid email or password');
  if (!res.ok) {
    throw new Error(`login failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const body = (await res.json()) as { token?: string; user?: { id?: string } };
  if (!body.token || !body.user?.id) {
    throw new Error('login response missing token or user id');
  }
  return { token: body.token, userId: body.user.id };
}

/** Best-effort token revoke — logout should still clear the local profile. */
async function postLogout(origin: string, token: string): Promise<void> {
  await fetch(`${origin}/api/aep/users/:logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function login(opts: LoginOptions): Promise<number> {
  const label = opts.profile?.trim() || DEFAULT_PROFILE_LABEL;
  const interactive = Boolean(process.stdin.isTTY);

  let server = opts.server?.trim();
  if (!server && interactive) {
    server = await promptText('Server URL', 'http://127.0.0.1:3000');
  }
  if (!server) {
    console.error('a server is required — pass --server=URL');
    return 1;
  }
  const origin = normalizeServer(server);

  let email = opts.email?.trim();
  if (!email && interactive) email = (await promptText('Email', '')).trim();
  if (!email) {
    console.error('an email is required — pass --email=EMAIL');
    return 1;
  }

  let password = opts.password;
  if (password === undefined && interactive) password = await promptHidden('Password: ');
  if (password === undefined) {
    console.error('a password is required — pass --password=PW (or run interactively)');
    return 1;
  }

  let result: { token: string; userId: string };
  try {
    result = await postLogin(origin, email, password);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  const profile: Profile = { server: origin, token: result.token, email, userId: result.userId };
  saveProfile(label, profile, { setDefault: opts.setDefault });

  const isDefault = loadCredentials().default === label;
  console.log(
    `Logged in to ${origin} as ${email} — saved profile "${label}"${isDefault ? ' (default)' : ''}.`,
  );
  return 0;
}

export async function logout(opts: { profile?: string }): Promise<number> {
  const creds = loadCredentials();
  const label = opts.profile?.trim() || creds.default;
  if (!label || !creds.profiles[label]) {
    console.error(label ? `no such profile "${label}"` : 'no default profile to log out of');
    return 1;
  }
  const profile = creds.profiles[label]!;
  try {
    await postLogout(profile.server, profile.token);
  } catch {
    // Server unreachable / token already gone — still drop it locally.
  }
  removeProfile(label);
  console.log(`Logged out and removed profile "${label}".`);
  return 0;
}

export function listProfiles(): number {
  const creds = loadCredentials();
  const labels = Object.keys(creds.profiles);
  if (labels.length === 0) {
    console.log('No profiles yet — run `homestead login` to create one.');
    return 0;
  }
  for (const label of labels) {
    const profile = creds.profiles[label]!;
    const marker = creds.default === label ? '*' : ' ';
    console.log(
      `${marker} ${label.padEnd(16)} ${(profile.email ?? '').padEnd(24)} ${profile.server}`,
    );
  }
  return 0;
}

export function useProfile(label: string): number {
  try {
    setDefaultProfile(label);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  console.log(`Default profile is now "${label}".`);
  return 0;
}

/** Prompt for free text, returning `def` on an empty answer. */
async function promptText(label: string, def: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const suffix = def ? ` [${def}]` : '';
    const ans = (await rl.question(`${label}${suffix}: `)).trim();
    return ans || def;
  } finally {
    rl.close();
  }
}

// Control bytes read in raw mode: Ctrl-C (ETX), Ctrl-D (EOT), DEL/backspace.
const ETX = 3;
const EOT = 4;
const DEL = 127;

/**
 * Read a line from a TTY without echoing it. Reads raw bytes so the password
 * never lands on screen or in scrollback; handles enter, backspace, and ^C.
 */
function promptHidden(prompt: string): Promise<string> {
  return new Promise<string>((resolvePw, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    output.write(prompt);
    const wasRaw = input.isRaw ?? false;
    if (input.isTTY) input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');

    let value = '';
    const cleanup = (): void => {
      input.removeListener('data', onData);
      if (input.isTTY) input.setRawMode(wasRaw);
      input.pause();
    };
    const onData = (chunk: string): void => {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0);
        if (ch === '\n' || ch === '\r' || code === EOT) {
          cleanup();
          output.write('\n');
          resolvePw(value);
          return;
        }
        if (code === ETX) {
          cleanup();
          output.write('\n');
          reject(new Error('cancelled'));
          return;
        }
        if (code === DEL || ch === '\b') {
          value = value.slice(0, -1);
        } else {
          value += ch;
        }
      }
    };
    input.on('data', onData);
  });
}

// getProfile is re-exported so the resources command can resolve profiles
// through one module.
export { getProfile };
