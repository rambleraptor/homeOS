/**
 * Pure path/response parsing for the file-index trigger. Kept separate from
 * `file-index-trigger.ts` so it carries no `app-registry` import — that module
 * runs boot-time config loading at import, which isn't available in a bare unit
 * test. These helpers stay trivially testable under both Bun and Node.
 */

export interface CrudWrite {
  plural: string;
  /** Present for item writes/deletes; absent for a collection create. */
  id?: string;
}

/**
 * Classify a plain-CRUD path (no `:verb` custom method, top-level only). Returns
 * null for custom methods, nested paths, or anything we don't auto-index.
 */
export function parseCrudWrite(path: string): CrudWrite | null {
  const clean = path.split('?')[0].replace(/^\/+/, '').replace(/\/+$/, '');
  if (!clean) return null;
  const segs = clean.split('/');
  if (segs.some((s) => s.includes(':'))) return null; // custom method
  if (segs.length === 1) return { plural: segs[0] };
  if (segs.length === 2) return { plural: segs[0], id: segs[1] };
  return null; // nested resource — not auto-indexed yet
}

/** The created record's id, from the engine's create response. */
export function idFromCreateBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const rec = body as { id?: string; path?: string; name?: string };
  if (rec.id) return rec.id;
  const ref = rec.path ?? rec.name;
  return ref ? ref.split('/').filter(Boolean).pop() : undefined;
}
