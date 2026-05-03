/**
 * Core Authentication Types for Homestead
 */

export type MapProvider = 'google' | 'apple';

export type UserType = 'superuser' | 'regular';

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
  logout: () => void;
  refreshUser: () => Promise<void>;
}
