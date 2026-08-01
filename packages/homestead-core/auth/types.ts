/**
 * Core Authentication Types for Homestead
 */

import type { PermissionContext } from '../permissions/client';

export type MapProvider = 'google' | 'apple';

export type UserType = 'superuser' | 'regular';

/** The session an OAuth callback delivers in the URL fragment. */
export interface OAuthSession {
  accessToken: string;
  /** Present when the server issued a refreshable session (the normal case). */
  refreshToken?: string;
  expiresIn?: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string;
  verified: boolean;
  emailVisibility?: boolean;
  created: string;
  updated: string;
  map_provider?: MapProvider;
  /** Ordered list of dashboard widget ids the user prefers (parsed from preferences). */
  dashboard_widget_order?: string[];
  /** Dashboard widget ids the user has hidden (parsed from preferences). */
  dashboard_hidden_widgets?: string[];
  type?: UserType;
  /**
   * The caller's permission context (group ids + expanded grants + whether
   * enforcement is on), hydrated on login from `/api/permissions/me`. Feeds the
   * client `can()` mirror (design §10). UX only — the engine is authoritative.
   */
  permissions?: PermissionContext;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  /**
   * Finish an OAuth login from the callback page: the federated callback handed
   * us a session in the URL fragment; this resolves the user via whoami,
   * hydrates preferences, and seeds the auth state, mirroring `login`.
   */
  completeOAuthLogin: (session: OAuthSession) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}
