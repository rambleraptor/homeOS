/**
 * CSV bulk-import format.
 *
 * An app declares its columns once as a {@link CsvSchema} and gets a parser:
 *
 *   // gift-cards/methods/bulk-import-csv.ts
 *   export default createCsvParser(giftCardCsvSchema);
 *
 * Server-only — pulled in through a format's lazy `load()`.
 */

import type {
  BulkImportContext,
  BulkImportInput,
  BulkImportParser,
  ParsedItem,
} from '../../resources/bulk-import/types';

/**
 * Validates and coerces one cell. Receives the whole row so a field can depend
 * on its neighbours. Return an `error` to mark the row un-importable.
 */
export type FieldValidator<T = unknown> = (
  value: string,
  row: Record<string, string>,
) => { value: T; error?: string };

export interface CsvFieldConfig<T = unknown> {
  /** Column header in the CSV. */
  name: string;
  required: boolean;
  validator: FieldValidator<T>;
  /** Applied when an optional column is absent or empty. */
  defaultValue?: T;
  description?: string;
}

export interface CsvSchema<T> {
  requiredFields: CsvFieldConfig[];
  optionalFields: CsvFieldConfig[];
  /**
   * Reshape a row after every field validator passes. Receives the validated
   * values keyed by column and returns the record to save — for when several
   * columns collapse into one field (e.g. `team_1..team_6` → `teams[]`).
   * Skipped on invalid rows.
   */
  transformParsed?: (raw: Record<string, unknown>) => T;
  /** Preview label for a row, e.g. the cardholder's name. */
  labelFor?: (raw: Record<string, unknown>, row: Record<string, string>) => string | undefined;
}

/** Build a {@link BulkImportParser} from a column schema. */
export function createCsvParser<T>(schema: CsvSchema<T>): BulkImportParser<T> {
  return {
    parse(input: BulkImportInput, _ctx: BulkImportContext): ParsedItem<T>[] {
      const files = input.files ?? [];
      return files.flatMap((file) =>
        parseCsv(new TextDecoder().decode(file.bytes), schema, file.name),
      );
    },
    // Derived from the schema so an app's column docs reach the import page
    // without being written out a second time.
    columns: [...schema.requiredFields, ...schema.optionalFields].map((field) => ({
      name: field.name,
      required: field.required,
      description: field.description,
    })),
  };
}

/**
 * Parse one CSV document into candidate items.
 *
 * A missing required *header* is fatal for the file, but it's reported as a
 * single errored item rather than thrown: when several files are imported at
 * once, one malformed file must not sink its neighbours.
 */
export function parseCsv<T>(
  content: string,
  schema: CsvSchema<T>,
  filename?: string,
): ParsedItem<T>[] {
  const rows = parseCsvRecords(content);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  const missing = schema.requiredFields
    .map((f) => f.name)
    .filter((name) => !headers.includes(name));
  if (missing.length > 0) {
    return [
      {
        index: 0,
        data: {} as T,
        errors: [`Missing required column(s): ${missing.join(', ')}`],
        warnings: [],
        label: filename,
      },
    ];
  }

  const items: ParsedItem<T>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    // A trailing newline yields one empty cell; that's not a row.
    if (values.length === 1 && values[0].trim() === '') continue;

    const row: Record<string, string> = {};
    headers.forEach((header, col) => {
      row[header] = values[col] ?? '';
    });
    items.push(parseRow(row, items.length, schema));
  }
  return items;
}

function parseRow<T>(
  row: Record<string, string>,
  index: number,
  schema: CsvSchema<T>,
): ParsedItem<T> {
  const errors: string[] = [];
  const raw: Record<string, unknown> = {};

  for (const field of [...schema.requiredFields, ...schema.optionalFields]) {
    const value = row[field.name]?.trim() ?? '';

    if (!value) {
      if (field.required) errors.push(`${field.name} is required`);
      else if (field.defaultValue !== undefined) raw[field.name] = field.defaultValue;
      continue;
    }

    try {
      const result = field.validator(value, row);
      if (result.error) errors.push(result.error);
      else raw[field.name] = result.value;
    } catch (error) {
      errors.push(
        `${field.name}: ${error instanceof Error ? error.message : 'Validation failed'}`,
      );
    }
  }

  const data =
    errors.length === 0 && schema.transformParsed
      ? schema.transformParsed(raw)
      : (raw as T);

  return {
    index,
    data,
    errors,
    warnings: [],
    label: schema.labelFor?.(raw, row),
  };
}

/**
 * Tokenize a CSV document into records of fields.
 *
 * Scans the whole document rather than splitting on newlines first, because a
 * newline inside a quoted field is data, not a record separator — splitting
 * first (as the old client-side parser did) silently mangled any row with a
 * multi-line note. Handles `""` as an escaped quote and CRLF line endings.
 */
export function parseCsvRecords(content: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    record.push(field.trim());
    field = '';
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n') {
      pushRecord();
    } else if (char === '\r') {
      // CRLF: the \n does the work. A lone \r is a record separator too.
      if (content[i + 1] === '\n') continue;
      pushRecord();
    } else {
      field += char;
    }
  }

  // Trailing content with no final newline is still a record. An unterminated
  // quote lands here too, keeping whatever was read rather than dropping it.
  if (field !== '' || record.length > 0) pushRecord();

  return records;
}

// ----------------------------------------------------------------------------
// Shared validators
// ----------------------------------------------------------------------------

/**
 * Accept any string up to `maxLength`. Every app had hand-rolled copies of this
 * under a dozen names (`validateNotes`, `validateLocation`, `validateAddress`,
 * …); they're all this.
 */
export function validateOptionalString(maxLength: number): FieldValidator<string> {
  return (value: string) => {
    if (value.length > maxLength) {
      return { value, error: `must be ${maxLength} characters or fewer` };
    }
    return { value };
  };
}

/** Accept a non-empty string up to `maxLength`. */
export function validateRequiredString(maxLength: number): FieldValidator<string> {
  return (value: string) => {
    if (!value) return { value, error: 'is required' };
    if (value.length > maxLength) {
      return { value, error: `must be ${maxLength} characters or fewer` };
    }
    return { value };
  };
}

/** Accept one of `allowed`, case-insensitively, normalizing to the declared casing. */
export function validateEnum(allowed: readonly string[]): FieldValidator<string> {
  return (value: string) => {
    const match = allowed.find((a) => a.toLowerCase() === value.toLowerCase());
    if (!match) {
      return { value, error: `must be one of: ${allowed.join(', ')}` };
    }
    return { value: match };
  };
}

/** Accept a finite number, optionally bounded. */
export function validateNumber(
  { min, max }: { min?: number; max?: number } = {},
): FieldValidator<number> {
  return (value: string) => {
    const parsed = Number(value.replace(/[$,]/g, ''));
    if (!Number.isFinite(parsed)) return { value: 0, error: 'must be a number' };
    if (min !== undefined && parsed < min) {
      return { value: parsed, error: `must be at least ${min}` };
    }
    if (max !== undefined && parsed > max) {
      return { value: parsed, error: `must be at most ${max}` };
    }
    return { value: parsed };
  };
}

/**
 * Accept the ways a spreadsheet writes a boolean. Deliberately generous —
 * `yes`/`1`/`TRUE` all mean the same thing to whoever typed them.
 */
export function validateBoolean(): FieldValidator<boolean> {
  const truthy = ['true', 'yes', '1'];
  const falsy = ['false', 'no', '0'];
  return (value: string) => {
    const normalized = value.toLowerCase().trim();
    if (falsy.includes(normalized) || normalized === '') return { value: false };
    if (truthy.includes(normalized)) return { value: true };
    return {
      value: false,
      error: `must be one of: ${[...truthy, ...falsy].join(', ')}`,
    };
  };
}

/** Accept a currency-ish amount (`$1,234.50`), rounded to cents. */
export function validateCurrency(
  { min }: { min?: number } = {},
): FieldValidator<number> {
  return (value: string) => {
    const parsed = Number(value.replace(/[$,]/g, ''));
    if (!Number.isFinite(parsed)) return { value: 0, error: 'must be a valid number' };
    if (min !== undefined && parsed < min) {
      return { value: parsed, error: `must be greater than or equal to ${min}` };
    }
    return { value: Math.round(parsed * 100) / 100 };
  };
}

/** Accept an ISO-ish date, normalizing to `YYYY-MM-DD`. */
export function validateDate(): FieldValidator<string> {
  return (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return { value, error: 'must be a date (YYYY-MM-DD)' };
    }
    return { value: parsed.toISOString().slice(0, 10) };
  };
}
