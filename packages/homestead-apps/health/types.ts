/**
 * Health App Types
 */

/**
 * Vaccination record from aepbase. Matches the shape declared in
 * `packages/homestead-apps/health/resources.ts`. Records are private to
 * their owner (`access: { model: 'private' }`), so a list only ever
 * contains the current user's records.
 */
export interface Vaccination {
  id: string;
  path: string;
  vaccine: string;
  /** ISO YYYY-MM-DD. */
  date_administered: string;
  dose?: string;
  provider?: string;
  lot_number?: string;
  /** ISO YYYY-MM-DD; unset when the series is complete. */
  next_due?: string;
  /** Stored filename of the uploaded record image (truthy when present). */
  record_image?: string;
  /** Bare id of the document this record was captured from, if any. */
  document?: string;
  notes?: string;
  created_by?: string;
  create_time: string;
  update_time: string;
}

/** Mutation payload. `record_image: null | undefined` means "no photo change". */
export interface VaccinationFormData {
  vaccine: string;
  date_administered: string;
  dose?: string;
  provider?: string;
  lot_number?: string;
  next_due?: string;
  record_image?: File | null;
  /** Bare document id, or '' to clear the link on update. */
  document?: string;
  notes?: string;
}

/** Due-state of a vaccination's `next_due` relative to today. */
export type DueStatus = 'overdue' | 'due-soon' | 'ok' | 'none';
