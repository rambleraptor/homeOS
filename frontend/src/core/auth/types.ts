/**
 * Core Authentication Types for HomeOS
 */

export type UserRole = 'admin' | 'member' | 'viewonly';

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string;
  role: UserRole;
  verified: boolean;
  emailVisibility?: boolean;
  created: string;
  updated: string;
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

export interface RegisterData {
  email: string;
  password: string;
  passwordConfirm: string;
  name: string;
  username: string;
  role?: UserRole;
}

export interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
  refreshUser: () => Promise<void>;
}
