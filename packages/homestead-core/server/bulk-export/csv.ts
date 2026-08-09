/**
 * CSV bulk-export format.
 *
 * The inverse of `core/server/bulk-import/csv.ts`: an app declares its columns
 * once and gets a serializer that renders rows to a CSV with a header line:
 *
 *   // people/methods/bulk-export-csv.ts
 *   export default createCsvSerializer(personColumns);
 *
 * Server-only — pulled in through a format's lazy `load()`.
 *
 * The escaping here is the exact reverse of the import tokenizer
 * (`parseCsvRecords`): a field is quoted when it contains a comma, a quote, or a
 * newline, and embedded quotes are doubled. A file this produces re-parses
 * cleanly, which is what makes export↔import round-trip when both sides share a
 * column list.
 */

import type {
  BulkExportColumnInfo,
  BulkExportContext,
  BulkExportSerializer,
} from '../../resources/bulk-export/types';

/** A column to emit. `value` reads the cell for a row; defaults to `row[name]`. */
export interface CsvColumn<T> {
  /** Header text, matching the import column of the same name for round-trip. */
  name: string;
  description?: string;
  /**
   * Pull this column's value out of a row. Defaults to reading the property
   * named `name`. Return anything; it's coerced to a string cell (null /
   * undefined become empty).
   */
  value?: (row: T) => unknown;
}

/** Quote a single field iff it needs it, doubling embedded quotes (RFC 4180). */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join('; ') : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Render a header + rows to a CSV document (CRLF line endings, RFC 4180). */
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => csvEscape(c.name)).join(',')];
  for (const row of rows) {
    lines.push(
      columns
        .map((c) => csvEscape(c.value ? c.value(row) : (row as Record<string, unknown>)[c.name]))
        .join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}

/**
 * Build a {@link BulkExportSerializer} from a column list. Accepts either bare
 * column names (read straight off each row) or {@link CsvColumn} objects when a
 * cell needs a custom accessor.
 */
export function createCsvSerializer<T>(
  columns: Array<string | CsvColumn<T>>,
): BulkExportSerializer<T> {
  const cols: CsvColumn<T>[] = columns.map((c) =>
    typeof c === 'string' ? { name: c } : c,
  );
  return {
    serialize(rows: T[], _ctx: BulkExportContext): string {
      return toCsv(cols, rows);
    },
    columns: cols.map<BulkExportColumnInfo>((c) => ({
      name: c.name,
      description: c.description,
    })),
  };
}
