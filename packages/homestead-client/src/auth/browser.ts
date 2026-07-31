import type { AuthStrategy } from './strategy';
import type { HomesteadUser } from '../types';

/** A subscriber notified whenever the browser session's token/user changes. */
export type SessionListener = (
  token: string,
  user: HomesteadUser | null,
) => void;

/** A browser strategy also exposes the current session and a change feed. */
export interface BrowserSessionStrategy extends AuthStrategy {
  /** The current token, or `''`. */
  readonly token: () => string | null;
  /** The current user, or `null`. */
  currentUser(): HomesteadUser | null;
  /** Subscribe to session changes; returns an unsubscribe. */
  onChange(listener: SessionListener): () => void;
}

export interface BrowserSessionOptions {
  /** localStorage key for the token. Default `homestead_token`. */
  tokenKey?: string;
  /** localStorage key for the JSON user. Default `homestead_user`. */
  userKey?: string;
  /**
   * Storage backend. Defaults to `window.localStorage` when available, else an
   * in-memory shim (so the strategy is safe to construct under SSR/tests).
   */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
}

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/**
 * Browser session backed by localStorage, with a change feed the SPA's auth
 * context can subscribe to. Reads any persisted token/user on construction so a
 * page reload stays logged in.
 */
export function browserSession(
  options: BrowserSessionOptions = {},
): BrowserSessionStrategy {
  const tokenKey = options.tokenKey ?? 'homestead_token';
  const userKey = options.userKey ?? 'homestead_user';
  const storage =
    options.storage ??
    (typeof globalThis !== 'undefined' &&
    'localStorage' in globalThis &&
    globalThis.localStorage
      ? globalThis.localStorage
      : memoryStorage());

  let token = storage.getItem(tokenKey) ?? '';
  let user: HomesteadUser | null = null;
  const rawUser = storage.getItem(userKey);
  if (rawUser) {
    try {
      user = JSON.parse(rawUser) as HomesteadUser;
    } catch {
      user = null;
    }
  }

  const listeners = new Set<SessionListener>();
  const emit = (): void => {
    for (const l of listeners) l(token, user);
  };

  const persist = (t: string, u: HomesteadUser | null): void => {
    token = t;
    user = u;
    if (t) storage.setItem(tokenKey, t);
    else storage.removeItem(tokenKey);
    if (u) storage.setItem(userKey, JSON.stringify(u));
    else storage.removeItem(userKey);
    emit();
  };

  return {
    token: () => token || null,
    userId: () => user?.id ?? null,
    setSession: (t, u) => persist(t, u),
    clear: () => persist('', null),
    onUnauthorized: () => persist('', null),
    currentUser: () => user,
    onChange: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
