/**
 * Contract for the standardized bulk-export screen.
 *
 * The screen is generic: it fetches a resource's records, lets the user pick a
 * subset with checkboxes and a search box, and exports the selection as an
 * `id in [...]` filter. It needs no knowledge of an app's list or item
 * components — only how to **label** a record in the picker, which defaults to a
 * record's `name`/`title`/`id`. That mirrors how the bulk-import page takes an
 * optional `preview` row and otherwise falls back to a default.
 */

/** A record as it comes back from the generic list fetch. Always has an id. */
export interface BulkExportRecord {
  id: string;
  [key: string]: unknown;
}

export interface BulkExportPageConfig {
  /** Plural of the resource to export, e.g. `people`. */
  plural: string;
  /** Display name, e.g. `People` (used in the page title). */
  appName: string;
  /** Lowercase plural, e.g. `people` (used in copy like "Export all people"). */
  appNamePlural: string;
  /** Where the back link goes, e.g. `/people`. */
  backRoute: string;
  /**
   * How to label a record in the picker. Defaults to the record's `name`,
   * then `title`, then `id`. Override for a resource whose display name lives
   * elsewhere. The label is also what the search box matches against.
   */
  label?: (record: BulkExportRecord) => string;
}

/** The default row label: `name`, then `title`, then the bare id. */
export function defaultLabel(record: BulkExportRecord): string {
  const candidate = record.name ?? record.title;
  return typeof candidate === 'string' && candidate.trim() !== ''
    ? candidate
    : record.id;
}
