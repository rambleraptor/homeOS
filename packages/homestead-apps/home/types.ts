/**
 * Home app types.
 *
 * `stream`, `status`, and `source` are declared as enums in `resources.ts`, but
 * aepbase strips JSON-schema enums on round-trip — the wire values are plain
 * strings. The types below narrow them for the UI's benefit; treat a value read
 * off the wire as untrusted and fall back gracefully (see `streamLabel`).
 */

import type { GARBAGE_STREAMS } from './resources';

export type GarbageStream = (typeof GARBAGE_STREAMS)[number];

export type GarbagePickupStatus = 'scheduled' | 'delayed';

/** Who wrote the row — a household member, or an automated hauler sync. */
export type GarbagePickupSource = 'manual' | 'wm';

export interface GarbagePickup {
  id: string;
  /** ISO `YYYY-MM-DD`, already holiday-adjusted. */
  pickup_date: string;
  stream: GarbageStream;
  status?: GarbagePickupStatus;
  /** ISO `YYYY-MM-DD` the pickup would have fallen on, when delayed. */
  original_date?: string;
  note?: string;
  service_description?: string;
  source?: GarbagePickupSource;
  create_time?: string;
  update_time?: string;
}

export interface GarbagePickupFormData {
  pickup_date: string;
  stream: GarbageStream;
  note?: string;
}
