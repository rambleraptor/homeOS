/**
 * OAuth scopes for the Homestead MCP server.
 *
 * A client authorizes with either a read-only or a read+write scope, and the
 * MCP surface is filtered to match: `homestead:read` exposes only the read
 * tools (the `read_*` per resource plus document search), while
 * `homestead:write` additionally exposes the create/update/delete tools. Both
 * scopes are advertised in the authorization server's discovery metadata, so a
 * client can request exactly the access it needs.
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
