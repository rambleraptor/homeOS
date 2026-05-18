/**
 * Authentication Provider Component
 *
 * Talks to aepbase via the thin wrapper at `core/api/aepbase`. POST
 * `/users/:login` for sign-in, Bearer token persisted in localStorage,
 * onChange subscription for cross-tab auth sync.
 *
 * There is no `register` — aepbase has no self-serve signup endpoint; users
 * are provisioned by a superuser via `POST /users`. `refreshUser` re-fetches
 * the aepbase user record AND the user's `preferences` child so the settings
 * module can write `map_provider` and have it visible everywhere via
 * `useAuth().user`.
 */

import { USERS, USER_PREFERENCES } from '@rambleraptor/homestead-core/resources/builtins';
import { useEffect, useState, useCallback } from 'react';
import type {
  AuthContextValue,
  AuthState,
  LoginCredentials,
  MapProvider,
  User,
} from './types';
import { AuthContext } from './context';
import { aepbase } from '../api/aepbase';
import { queryClient, queryKeys } from '../api/queryClient';
import { clearPersistedQueryCache } from '../api/persistQueryClient';
import { logger } from '../utils/logger';
import { ACCOUNT_TAGS } from '../superuser/users/resources';

interface AccountTagRecord {
  id: string;
  name: string;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

interface UserPreferenceRecord {
  id: string;
  /** Legacy field, replaced by `people__map_provider`. */
  map_provider?: MapProvider;
  /** Per-user setting declared by the People module. */
  people__map_provider?: MapProvider;
  dashboard_widget_order?: string;
  dashboard_hidden_widgets?: string;
}

function parseStringArray(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      return parsed;
    }
  } catch {
    // fall through to undefined
  }
  return undefined;
}

const VALID_MAP_PROVIDERS: readonly MapProvider[] = ['google', 'apple'];

function coerceMapProvider(raw: unknown): MapProvider | undefined {
  if (typeof raw !== 'string') return undefined;
  return VALID_MAP_PROVIDERS.includes(raw as MapProvider)
    ? (raw as MapProvider)
    : undefined;
}

/**
 * Best-effort copy of the legacy `map_provider` field into the new
 * `people__map_provider` slot. Fire-and-forget — failures are logged
 * but don't block sign-in. Idempotent: only runs when the legacy field
 * is set and the new field is absent.
 */
async function backfillMapProvider(
  userId: string,
  preferenceId: string,
  legacyValue: MapProvider,
): Promise<void> {
  try {
    await aepbase.update<UserPreferenceRecord>(
      USER_PREFERENCES,
      preferenceId,
      { people__map_provider: legacyValue },
      { parent: [USERS, userId] },
    );
  } catch (error) {
    logger.warn('Failed to backfill people__map_provider', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function fetchAccountTags(userId: string): Promise<string[] | undefined> {
  try {
    const records = await aepbase.list<AccountTagRecord>(ACCOUNT_TAGS, {
      parent: [USERS, userId],
    });
    if (records.length === 0) return undefined;
    return records.map((r) => r.name).filter((n) => typeof n === 'string' && n.length > 0);
  } catch (error) {
    logger.warn('Failed to fetch account tags', {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

async function hydrateUserPreferences(user: User): Promise<User> {
  const [prefsResult, tags] = await Promise.all([
    (async () => {
      try {
        return await aepbase.list<UserPreferenceRecord>(USER_PREFERENCES, {
          parent: [USERS, user.id],
        });
      } catch (error) {
        logger.error('Failed to fetch user preferences', error);
        return [] as UserPreferenceRecord[];
      }
    })(),
    fetchAccountTags(user.id),
  ]);

  let merged: User = { ...user, tags };

  if (prefsResult.length > 0) {
    const record = prefsResult[0];
    const flattened = coerceMapProvider(record.people__map_provider);
    const legacy = coerceMapProvider(record.map_provider);
    const mapProvider = flattened ?? legacy;

    // Lazy migration: copy the legacy value into the new slot the
    // first time we see one without the other. The cleared legacy
    // field can be dropped from the schema in a follow-up after a
    // deploy cycle.
    if (!flattened && legacy) {
      void backfillMapProvider(user.id, record.id, legacy);
    }

    merged = {
      ...merged,
      map_provider: mapProvider,
      dashboard_widget_order: parseStringArray(record.dashboard_widget_order),
      dashboard_hidden_widgets: parseStringArray(record.dashboard_hidden_widgets),
    };
  }

  return merged;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const user = aepbase.getCurrentUser();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({
      user,
      token: aepbase.authStore.token || null,
      isAuthenticated: aepbase.authStore.isValid,
      isLoading: false,
    });
  }, []);

  useEffect(() => {
    let lastUserId: string | null = aepbase.getCurrentUser()?.id ?? null;
    const unsubscribe = aepbase.authStore.onChange((token, user) => {
      setState({
        user,
        token: token || null,
        isAuthenticated: !!token && !!user,
        isLoading: false,
      });
      const nextUserId = user?.id ?? null;
      // On logout OR when a different user logs in (same browser session),
      // drop both the in-memory query cache and its persisted snapshot —
      // otherwise the next `PersistQueryClientProvider` mount rehydrates
      // the previous user's optimistic state into the new session.
      if (!user || nextUserId !== lastUserId) {
        queryClient.clear();
        clearPersistedQueryCache();
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.user() });
      }
      lastUserId = nextUserId;
    });
    return () => unsubscribe();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const baseUser = await aepbase.login(credentials.email, credentials.password);
      const hydrated = await hydrateUserPreferences(baseUser);
      aepbase.authStore.save(aepbase.authStore.token, hydrated);
      await queryClient.invalidateQueries();
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    aepbase.logout();
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    queryClient.clear();
    clearPersistedQueryCache();
  }, []);

  const refreshUser = useCallback(async () => {
    if (!aepbase.authStore.isValid) return;
    try {
      const baseUser = await aepbase.refreshCurrentUser();
      if (!baseUser) return;
      const hydrated = await hydrateUserPreferences(baseUser);
      aepbase.authStore.save(aepbase.authStore.token, hydrated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.user() });
    } catch (error) {
      logger.error('Failed to refresh user', error);
      logout();
    }
  }, [logout]);

  const value: AuthContextValue = { ...state, login, logout, refreshUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
