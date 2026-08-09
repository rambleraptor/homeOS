/**
 * Id-selection for bulk export.
 *
 * The framework passes a `?ids=` allowlist to the source (see
 * {@link BulkExportSource}). Because a source's output rows may have dropped the
 * record id by the time they're shaped, id-selection has to happen *inside* the
 * source, while it still holds the records — so this helper is what both the
 * default source and any custom source call to apply the allowlist.
 *
 * Pure and dependency-free (no server imports), so it lives beside the contract
 * types rather than under `server/`.
 */

/**
 * Thrown by {@link selectByIds} when the allowlist names a record that isn't in
 * the fetched set — deleted between the client listing it and the export
 * running, or simply a bad id. The handler maps this to a `400`: a caller who
 * named a specific record should hear it's gone rather than get a quietly
 * shorter file (mirrors bulk import rejecting a selected index that isn't in the
 * parse).
 */
export class BulkExportSelectionError extends Error {
  constructor(public readonly missing: string[]) {
    super(
      `Selected ${missing.length === 1 ? 'record' : 'records'} not found: ${missing.join(', ')}`,
    );
    this.name = 'BulkExportSelectionError';
  }
}

/**
 * Narrow `records` to the `ids` allowlist, preserving the input order (the
 * collection's natural order, not the order ids were listed) so an export is
 * stable and re-runnable. Returns everything when `ids` is undefined. Throws
 * {@link BulkExportSelectionError} if any requested id is absent.
 */
export function selectByIds<T>(
  records: T[],
  ids: string[] | undefined,
  getId: (record: T) => string,
): T[] {
  if (!ids) return records;
  const present = new Set(records.map(getId));
  const missing = ids.filter((id) => !present.has(id));
  if (missing.length > 0) throw new BulkExportSelectionError(missing);
  const wanted = new Set(ids);
  return records.filter((record) => wanted.has(getId(record)));
}
