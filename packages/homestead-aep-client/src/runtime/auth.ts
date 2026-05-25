/**
 * Token sources for the AEP client. Implementations decide where the
 * Bearer token comes from — browser localStorage, a request header,
 * an environment variable. The transport calls `getToken()` before
 * each request.
 */
export interface TokenProvider {
  getToken(): string | null | Promise<string | null>;
}

/** Static token, typically used in Next.js server routes after the
 *  request has been authenticated and the user's token forwarded. */
export function bearerAuth(token: string): TokenProvider {
  return { getToken: () => token };
}

/** No auth at all — for the unauthenticated `:login` path. */
export function noAuth(): TokenProvider {
  return { getToken: () => null };
}
