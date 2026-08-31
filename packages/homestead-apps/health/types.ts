/**
 * Health App Types
 */

/**
 * Vaccine series record from aepbase — the top-line grouping ("Tdap",
 * "Influenza") for a user's dose history, and the home of series-level state
 * like `next_due`. Matches the shape declared in
 * `packages/homestead-apps/health/resources.ts`. Records are private to
 * their owner (`access: { model: 'private' }`), so a list only ever
 * contains the current user's records.
 */
export interface Vaccine {
  id: string;
  path: string;
  name: string;
  /** ISO YYYY-MM-DD; unset when the series is complete. */
  next_due?: string;
  notes?: string;
  created_by?: string;
  create_time: string;
  update_time: string;
}

export interface VaccineFormData {
  name: string;
  next_due?: string;
  notes?: string;
}

/**
 * One administered dose, stored under its vaccine series at
 * `/vaccines/{id}/vaccinations/{id}` — the parent id lives in the URL, not a
 * stored field.
 */
export interface Vaccination {
  id: string;
  path: string;
  /** ISO YYYY-MM-DD. */
  date_administered: string;
  dose?: string;
  provider?: string;
  lot_number?: string;
  /** Stored filename of the uploaded record image (truthy when present). */
  record_image?: string;
  /** Bare id of the document this dose was captured from, if any. */
  document?: string;
  notes?: string;
  created_by?: string;
  create_time: string;
  update_time: string;
}

/** Mutation payload. `record_image: null | undefined` means "no photo change". */
export interface VaccinationFormData {
  date_administered: string;
  dose?: string;
  provider?: string;
  lot_number?: string;
  record_image?: File | null;
  /** Bare document id, or '' to clear the link on update. */
  document?: string;
  notes?: string;
}

/** Due-state of a vaccine's `next_due` relative to today. */
export type DueStatus = 'overdue' | 'due-soon' | 'ok' | 'none';
