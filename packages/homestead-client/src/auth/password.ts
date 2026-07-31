import type { AuthStrategy, AuthTransport } from './strategy';
import type { HomesteadUser } from '../types';
import { rawLogin } from '../user';

/**
 * Lazy email + password login, for scripts and integrations. No token is
 * fetched until the first authenticated call; the result is cached, and a 401
 * clears the cache so the next call re-authenticates. This keeps credential
 * handling to one place and survives short-lived-token servers.
 */
export function password(creds: {
  email: string;
  password: string;
}): AuthStrategy {
  let transport: AuthTransport | undefined;
  let cached: { token: string; userId: string } | null = null;
  let inflight: Promise<{ token: string; userId: string }> | null = null;

  async function ensure(): Promise<{ token: string; userId: string }> {
    if (cached) return cached;
    if (!transport) {
      throw new Error(
        'password() strategy was not attached to a client — use createHomesteadClient',
      );
    }
    // De-dupe concurrent first calls so they share one login round-trip.
    if (!inflight) {
      const t = transport;
      inflight = rawLogin(t, creds.email, creds.password)
        .then((session) => {
          cached = { token: session.token, userId: session.user.id };
          return cached;
        })
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  }

  return {
    attach: (t: AuthTransport) => {
      transport = t;
    },
    token: async () => (await ensure()).token,
    userId: async () => (await ensure()).userId,
    setSession: (token: string, user: HomesteadUser | null) => {
      cached = { token, userId: user?.id ?? cached?.userId ?? '' };
    },
    clear: () => {
      cached = null;
    },
    onUnauthorized: () => {
      cached = null;
    },
  };
}
