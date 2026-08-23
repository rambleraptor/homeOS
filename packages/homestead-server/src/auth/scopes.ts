/**
 * OAuth scope vocabulary.
 *
 * A client authorizes with either a read-only or a read+write scope. Two things
 * consult it, and they are not the same thing:
 *
 *  - **Enforcement** (`engine/enforce.ts`): the scope is a ceiling on the verbs
 *    the credential may exercise, applied on every request the token makes
 *    through any door. This is the security boundary.
 *  - **Presentation** (`routes/mcp.ts`): the MCP tool surface is filtered to
 *    match, so a read-only client is not offered writers it would only be
 *    refused for. This is ergonomics, and it must never be the only check —
 *    an OAuth access token is an ordinary engine bearer token, so anything it
 *    is not allowed to do has to be refused at the engine as well.
 *
 * Both scopes are advertised in the authorization server's discovery metadata,
 * so a client can request exactly the access it needs.
 */

/** Read-only access: the `read_*` tools and document search. */
export const MCP_SCOPE_READ = 'homestead:read';

/** Read + write access: everything read grants, plus create/update/delete. */
export const MCP_SCOPE_WRITE = 'homestead:write';

/**
 * The original broad scope, granted to tokens issued before the read/write
 * split. Treated as full read+write so existing authorizations keep working.
 */
export const MCP_SCOPE_LEGACY = 'homestead';

/** Scopes advertised to clients via OAuth discovery metadata. */
export const MCP_SCOPES_SUPPORTED = [MCP_SCOPE_READ, MCP_SCOPE_WRITE];

/** Split a space-delimited scope string into a set of granted scopes. */
function scopeSet(scope: string | null | undefined): Set<string> {
  return new Set((scope ?? '').split(/\s+/).filter(Boolean));
}

/**
 * Whether a granted scope authorizes the write tools (create/update/delete).
 *
 * The explicit write scope grants it, as does the legacy broad `homestead`
 * scope and an unscoped token (no scope binding at all) — both predate the
 * split and must retain their full access. Only a token scoped purely
 * read-only (`homestead:read` without a write scope) is limited to reads.
 */
export function scopeAllowsWrite(scope: string | null | undefined): boolean {
  const scopes = scopeSet(scope);
  if (scopes.has(MCP_SCOPE_WRITE) || scopes.has(MCP_SCOPE_LEGACY)) return true;
  if (scopes.has(MCP_SCOPE_READ)) return false;
  // Unscoped (or an unrecognized scope): full access, matching pre-split behavior.
  return true;
}
