/**
 * aepbase REST client (compatibility shim).
 *
 * This file used to own the HTTP transport, error envelope parsing, and
 * the function-based CRUD surface. All of that now lives in
 * `@rambleraptor/homestead-aep-client`. The exports here are preserved
 * for hooks/components that import `aepbase.list/get/create/...` —
 * Phase 2 will migrate those call sites to the typed `HomesteadClient`,
 * after which this shim can go away.
 *
 * Auth (authStore + login/logout/refreshCurrentUser) stays in this file
 * because it is homestead-specific: the token store is shared with
 * AuthContext, and `:login` is the only aepbase endpoint we hit
 * unauthenticated.
 */

import {
  AepError,
  Transport,
  type TokenProvider,
} from '@rambleraptor/homestead-aep-client';
import type { User, UserType } from '../auth/types';

const AEP_BASE = '/api/aep';
const AUTH_TOKEN_KEY = 'aepbase_auth_token';
const AUTH_USER_KEY = 'aepbase_auth_user';

// ----------------------------------------------------------------------------
// Errors — re-exported under the legacy name so `instanceof AepbaseError`
// checks throughout the codebase keep working.
// ----------------------------------------------------------------------------

export { AepError as AepbaseError } from '@rambleraptor/homestead-aep-client';

// ----------------------------------------------------------------------------
// Auth store (PocketBase-shaped, so AuthContext changes are minimal)
// ----------------------------------------------------------------------------

interface RawAepUser {
  id: string;
  path: string;
  email: string;
  display_name?: string;
  type?: string;
  create_time: string;
  update_time: string;
}

function mapAepUser(raw: RawAepUser): User {
  const type: UserType | undefined =
    raw.type === 'superuser' || raw.type === 'regular' ? raw.type : undefined;
  return {
    id: raw.id,
    email: raw.email,
    username: raw.email,
    name: raw.display_name || '',
    verified: true,
    created: raw.create_time,
    updated: raw.update_time,
    type,
  };
}

type AuthChangeListener = (token: string, user: User | null) => void;

class AuthStore {
  private _token: string | null = null;
  private _user: User | null = null;
  private listeners = new Set<AuthChangeListener>();

  constructor() {
    if (typeof window !== 'undefined') {
      this._token = window.localStorage.getItem(AUTH_TOKEN_KEY);
      const rawUser = window.localStorage.getItem(AUTH_USER_KEY);
      if (rawUser) {
        try {
          this._user = JSON.parse(rawUser) as User;
        } catch {
          this._user = null;
        }
      }
    }
  }

  get token(): string {
    return this._token || '';
  }

  get isValid(): boolean {
    return !!this._token;
  }

  get model(): User | null {
    return this._user;
  }

  save(token: string, user: User | null): void {
    this._token = token;
    this._user = user;
    if (typeof window !== 'undefined') {
      if (token) {
        window.localStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
      }
      if (user) {
        window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      } else {
        window.localStorage.removeItem(AUTH_USER_KEY);
      }
    }
    this.emit();
  }

  clear(): void {
    this.save('', null);
  }

  onChange(listener: AuthChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this._token || '', this._user);
    }
  }
}

export const authStore = new AuthStore();

// ----------------------------------------------------------------------------
// Shared transport — every CRUD helper below routes through this single
// instance so error handling, content-type detection, and the auth header
// match the typed client byte-for-byte.
// ----------------------------------------------------------------------------

const authProvider: TokenProvider = {
  getToken: () => authStore.token || null,
};
const transport = new Transport({ baseUrl: AEP_BASE, auth: authProvider });

// ----------------------------------------------------------------------------
// Resource path helpers (legacy parent-path tuple format)
// ----------------------------------------------------------------------------

/** Alternating [plural, id, plural, id, ...] segments naming the parent chain. */
export type ParentPath = string[];

function collectionPath(plural: string, parent?: ParentPath): string {
  if (!parent || !parent.length) return `/${plural}`;
  return `/${parent.join('/')}/${plural}`;
}

function itemPath(plural: string, id: string, parent?: ParentPath): string {
  return `${collectionPath(plural, parent)}/${id}`;
}

// ----------------------------------------------------------------------------
// CRUD — thin wrappers around the shared Transport
// ----------------------------------------------------------------------------

interface ListOptions {
  filter?: string;
  parent?: ParentPath;
  maxPageSize?: number;
}

interface ListResponse<T> {
  results?: T[];
  next_page_token?: string;
}

interface ItemOptions {
  parent?: ParentPath;
}

export async function list<T>(plural: string, options: ListOptions = {}): Promise<T[]> {
  const { filter, parent, maxPageSize = 100 } = options;
  const path = collectionPath(plural, parent);
  const out: T[] = [];
  let pageToken: string | undefined;
  do {
    const page = await transport.request<ListResponse<T>>(path, {
      query: {
        max_page_size: maxPageSize,
        page_token: pageToken,
        filter,
      },
    });
    if (page.results) out.push(...page.results);
    pageToken = page.next_page_token || undefined;
  } while (pageToken);
  return out;
}

export async function get<T>(plural: string, id: string, options: ItemOptions = {}): Promise<T> {
  return await transport.request<T>(itemPath(plural, id, options.parent));
}

export async function create<T>(
  plural: string,
  body: Record<string, unknown> | FormData,
  options: ItemOptions = {},
): Promise<T> {
  return await transport.request<T>(collectionPath(plural, options.parent), {
    method: 'POST',
    body,
  });
}

export async function update<T>(
  plural: string,
  id: string,
  body: Record<string, unknown> | FormData,
  options: ItemOptions = {},
): Promise<T> {
  return await transport.request<T>(itemPath(plural, id, options.parent), {
    method: 'PATCH',
    body,
    mergePatch: !(body instanceof FormData),
  });
}

export async function remove(
  plural: string,
  id: string,
  options: ItemOptions = {},
): Promise<void> {
  await transport.request<void>(itemPath(plural, id, options.parent), {
    method: 'DELETE',
  });
}

/**
 * Fetch the bytes of a file-field property via aepbase's auto-registered
 * `:download` custom method. Returns a Blob.
 *
 * The download URL aepbase echoes back in the field on read (e.g.
 * `front_image: "http://.../gift-cards/{id}:download?field=front_image"`)
 * is misleading: only the POST form of `:download` works, not GET. So the
 * browser cannot put it directly into an `<img src>` — callers need to
 * blob-URL the result. See `useGiftCardImageUrl` for the consumer pattern.
 */
export async function download(
  plural: string,
  id: string,
  field: string,
  options: ItemOptions = {},
): Promise<Blob> {
  const res = await transport.request<Response>(
    `${itemPath(plural, id, options.parent)}:download`,
    {
      method: 'POST',
      body: { field },
      raw: true,
    },
  );
  return await res.blob();
}

// ----------------------------------------------------------------------------
// Auth
// ----------------------------------------------------------------------------

interface LoginResponse {
  token: string;
  user: RawAepUser;
}

/**
 * Authenticate against aepbase. The only unauthenticated endpoint —
 * `POST /users/:login` — exchanges email + password for a Bearer token.
 * On success the token + user are persisted in the auth store and any
 * `onChange` listeners fire.
 */
export async function login(email: string, password: string): Promise<User> {
  const res = await transport.request<LoginResponse>('/users/:login', {
    method: 'POST',
    body: { email, password },
  });
  const user = mapAepUser(res.user);
  authStore.save(res.token, user);
  return user;
}

export function logout(): void {
  authStore.clear();
}

export async function refreshCurrentUser(): Promise<User | null> {
  if (!authStore.isValid || !authStore.model) return null;
  const raw = await transport.request<RawAepUser>(
    `/users/${authStore.model.id}`,
  );
  const user = mapAepUser(raw);
  authStore.save(authStore.token, user);
  return user;
}

export function getCurrentUser(): User | null {
  return authStore.model;
}

// Re-export the underlying error type under its new name so new code
// can `instanceof AepError` while legacy code keeps using `AepbaseError`.
export { AepError };

// ----------------------------------------------------------------------------
// Default export — namespace of operations for hook callers
// ----------------------------------------------------------------------------

export const aepbase = {
  list,
  get,
  create,
  update,
  remove,
  download,
  login,
  logout,
  refreshCurrentUser,
  getCurrentUser,
  authStore,
};

export default aepbase;
