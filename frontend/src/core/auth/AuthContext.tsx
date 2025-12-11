/**
 * Authentication Context
 *
 * Provides authentication state and methods throughout the application.
 * Manages user sessions, login, logout, and registration.
 */

import React, { createContext, useEffect, useState, useCallback } from 'react';
import {
  AuthContextValue,
  AuthState,
  LoginCredentials,
  RegisterData,
  User,
} from './types';
import { pb, getCurrentUser, clearAuth, onAuthChange, Collections } from '../api/pocketbase';
import { queryClient, queryKeys } from '../api/queryClient';

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

export const AuthContext = createContext<AuthContextValue>({
  ...initialState,
  login: async () => {},
  logout: () => {},
  register: async () => {},
  refreshUser: async () => {},
});

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(initialState);

  /**
   * Initialize auth state from PocketBase store
   */
  useEffect(() => {
    const user = getCurrentUser();
    setState({
      user,
      token: pb.authStore.token || null,
      isAuthenticated: pb.authStore.isValid,
      isLoading: false,
    });

    // Subscribe to auth changes
    const unsubscribe = onAuthChange((token, model) => {
      setState({
        user: model,
        token: token || null,
        isAuthenticated: !!token && !!model,
        isLoading: false,
      });

      // Invalidate user queries on auth change
      if (!model) {
        queryClient.clear();
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.user() });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Login with email and password
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const authData = await pb
        .collection(Collections.USERS)
        .authWithPassword(credentials.email, credentials.password);

      const user = authData.record as User;

      setState({
        user,
        token: pb.authStore.token || null,
        isAuthenticated: true,
        isLoading: false,
      });

      // Invalidate queries to fetch fresh data
      await queryClient.invalidateQueries();
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  /**
   * Logout current user
   */
  const logout = useCallback(() => {
    clearAuth();
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // Clear all cached data
    queryClient.clear();
  }, []);

  /**
   * Register new user
   */
  const register = useCallback(async (data: RegisterData) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Create the user
      const user = await pb.collection(Collections.USERS).create({
        ...data,
        emailVisibility: true,
        // Default role is 'member' unless specified
        role: data.role || 'member',
      });

      // Auto-login after registration
      await login({
        email: data.email,
        password: data.password,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [login]);

  /**
   * Refresh user data from server
   */
  const refreshUser = useCallback(async () => {
    if (!state.user?.id) return;

    try {
      const user = await pb.collection(Collections.USERS).getOne(state.user.id);
      setState((prev) => ({
        ...prev,
        user: user as User,
      }));

      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.user() });
    } catch (error) {
      console.error('Failed to refresh user:', error);
      // If refresh fails, user might be deleted or token invalid
      logout();
    }
  }, [state.user?.id, logout]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    register,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
