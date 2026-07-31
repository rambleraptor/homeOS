import type { HomesteadUser, RawUser } from './types';
import type { AuthTransport } from './auth/strategy';
import { errorFromResponse } from './errors';

/** Map aepbase's wire `user` record onto the lean {@link HomesteadUser} view. */
export function mapUser(raw: RawUser): HomesteadUser {
  const type =
    raw.type === 'superuser' || raw.type === 'regular' ? raw.type : undefined;
  return {
    id: raw.id,
    email: raw.email,
    name: raw.display_name ?? '',
    type,
    created: raw.create_time,
    updated: raw.update_time,
    raw,
  };
}

/** Raw login result: the token plus the mapped user. */
export interface Session {
  token: string;
  user: HomesteadUser;
}

/**
 * Exchange email + password for a bearer token via `POST /users/:login` — the
 * one unauthenticated write the engine exposes. Shared by `auth.login` and the
 * lazy `password()` strategy so the wire contract lives in one place.
 */
export async function rawLogin(
  transport: AuthTransport,
  email: string,
  password: string,
): Promise<Session> {
  const path = '/users/:login';
  const res = await transport.fetch(`${transport.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }
  if (!res.ok) throw errorFromResponse(res.status, path, text, parsed);
  const body = parsed as { token?: string; user?: RawUser } | undefined;
  if (!body?.token || !body.user) {
    throw errorFromResponse(res.status, path, text, parsed);
  }
  return { token: body.token, user: mapUser(body.user) };
}
