import type { AuthStrategy } from './strategy';
import type { HomesteadUser } from '../types';

/**
 * A pre-obtained token + user id, the shape the CLI stores per login profile.
 * (Structurally compatible with the CLI's `Profile`, minus the display fields.)
 */
export interface ProfileCredentials {
  token: string;
  userId: string;
}

/**
 * Authenticate from a stored profile. Identical to {@link bearerToken} but
 * named for the CLI's mental model, and it always carries a `userId` so
 * custom-method calls through the gateway send `X-User-Id`.
 */
export function profile(creds: ProfileCredentials): AuthStrategy {
  let token = creds.token;
  let userId = creds.userId;
  return {
    token: () => token || null,
    userId: () => userId || null,
    setSession: (t: string, user: HomesteadUser | null) => {
      token = t;
      userId = user?.id ?? userId;
    },
    clear: () => {
      token = '';
      userId = '';
    },
  };
}
