import type { AuthStrategy } from './strategy';

/**
 * No credentials. Only the unauthenticated surface (`/users/:login`,
 * `/oauth/providers`) will succeed; everything else gets a 401. The default
 * when `createHomesteadClient` is called with no `auth`.
 */
export function anonymous(): AuthStrategy {
  return { token: () => null };
}
