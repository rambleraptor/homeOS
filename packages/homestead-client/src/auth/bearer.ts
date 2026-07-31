import type { AuthStrategy } from './strategy';
import type { HomesteadUser } from '../types';

/**
 * A static bearer token. This is what server-side routes use: they forward the
 * end user's token and act as that user for the duration of one request. An
 * optional `userId` supplies the `X-User-Id` header custom methods need.
 *
 * The token is mutable via `setSession`/`clear` so a longer-lived holder (e.g.
 * a script that later calls `auth.login`) stays coherent.
 */
export function bearerToken(token: string, userId?: string): AuthStrategy {
  let current = token;
  let id = userId ?? null;
  return {
    token: () => current || null,
    userId: () => id,
    setSession: (t: string, user: HomesteadUser | null) => {
      current = t;
      id = user?.id ?? id;
    },
    clear: () => {
      current = '';
      id = null;
    },
  };
}
