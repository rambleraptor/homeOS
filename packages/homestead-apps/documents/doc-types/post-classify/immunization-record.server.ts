/**
 * post_classify hook for the `immunization-record` doc type.
 *
 * When a document is classified as an immunization record, mirror every
 * extracted dose into the Health app: find-or-create the owner's `vaccine`
 * series by name (case-insensitive), then create one `vaccination` child per
 * dose, each linking back to the document via its `document` field. One
 * document may hold several doses across several vaccines.
 *
 * The dispatcher's `linked_resource` guard normally prevents re-runs, but a
 * partially-failed run can leave it unset — so the hook is also idempotent on
 * its own: a dose from this document with the same vaccine and date is never
 * created twice.
 *
 * Privacy falls out of the caller: everything is created through
 * `serverClient(auth.token)`, so the series and doses belong to whoever
 * classified the document, exactly as private as the document itself.
 *
 * Server-only (`.server.ts`): the client build stubs this module, so its
 * cross-app import and the aepbase helper never reach the browser bundle. It
 * is only ever reached through the lazy `post_classify` thunk on the doc type.
 */

import { serverClient } from '@rambleraptor/homestead-core/server/client';
import type { PostClassifyHandler } from '../docType';
import { VACCINATIONS, VACCINES } from '../../../health/resources';
import type { Vaccination, Vaccine } from '../../../health/types';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** One dose as extracted from the document, coerced and date-validated. */
export interface ExtractedDose {
  vaccine: string;
  /** ISO YYYY-MM-DD. */
  date_administered: string;
  dose?: string;
  provider?: string;
  lot_number?: string;
}

/**
 * Coerce a printed date to ISO YYYY-MM-DD. The extraction prompt prefers ISO
 * already; anything else goes through `Date`. Undefined when unparseable —
 * `date_administered` is required on the vaccination, and inventing a date
 * would be worse than skipping the dose.
 */
function toIsoDay(printed: string | undefined): string | undefined {
  if (!printed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(printed)) return printed;
  const parsed = new Date(printed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

/** Case-insensitive, whitespace-collapsed key for matching series names. */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * The document's usable doses: the extracted `doses` array (entries with a
 * readable vaccine name and date), falling back to the scalar summary fields
 * when the array came back empty — a single-dose card still yields its one
 * record.
 */
export function extractDoses(metadata: Record<string, unknown>): ExtractedDose[] {
  const fromArray = (Array.isArray(metadata.doses) ? metadata.doses : [])
    .filter(
      (v): v is Record<string, unknown> =>
        !!v && typeof v === 'object' && !Array.isArray(v),
    )
    .map((entry): ExtractedDose | undefined => {
      const vaccine = asString(entry.vaccine);
      const date = toIsoDay(asString(entry.date_administered));
      if (!vaccine || !date) return undefined;
      return {
        vaccine,
        date_administered: date,
        dose: asString(entry.dose),
        provider: asString(entry.provider),
        lot_number: asString(entry.lot_number),
      };
    })
    .filter((d): d is ExtractedDose => d !== undefined);
  if (fromArray.length > 0) return fromArray;

  const vaccine = asString(metadata.vaccine);
  const date = toIsoDay(asString(metadata.date_administered));
  if (!vaccine || !date) return [];
  return [
    {
      vaccine,
      date_administered: date,
      dose: asString(metadata.dose),
      provider: asString(metadata.provider),
      lot_number: asString(metadata.lot_number),
    },
  ];
}

const handler: PostClassifyHandler = async ({ document, metadata, auth }) => {
  const doses = extractDoses(metadata);
  if (doses.length === 0) return;

  const client = serverClient(auth.token);
  const vaccinesRef = client.collection<Vaccine>(VACCINES);

  // The caller's own series (the private model scopes the list), keyed for
  // case-insensitive find-or-create.
  const existing = await vaccinesRef.listAll();
  const byName = new Map(existing.map((v) => [nameKey(v.name), v]));
  // Existing doses per touched series, fetched once each, for the dedupe pass.
  const dosesByVaccine = new Map<string, Vaccination[]>();

  let linkedVaccineId: string | undefined;

  for (const dose of doses) {
    let vaccine = byName.get(nameKey(dose.vaccine));
    if (!vaccine) {
      vaccine = await vaccinesRef.create({
        name: dose.vaccine,
        ...(document.created_by ? { created_by: document.created_by } : {}),
      });
      byName.set(nameKey(dose.vaccine), vaccine);
      dosesByVaccine.set(vaccine.id, []);
    }

    const dosesRef = vaccinesRef.record(vaccine.id).collection<Vaccination>(VACCINATIONS);
    let known = dosesByVaccine.get(vaccine.id);
    if (!known) {
      known = await dosesRef.listAll();
      dosesByVaccine.set(vaccine.id, known);
    }
    // Same document, same day, same series → already mirrored; skip.
    const duplicate = known.some(
      (d) => d.document === document.id && d.date_administered === dose.date_administered,
    );
    if (duplicate) {
      linkedVaccineId ??= vaccine.id;
      continue;
    }

    const created = await dosesRef.create({
      date_administered: dose.date_administered,
      ...(dose.dose ? { dose: dose.dose } : {}),
      ...(dose.provider ? { provider: dose.provider } : {}),
      ...(dose.lot_number ? { lot_number: dose.lot_number } : {}),
      document: document.id,
      ...(document.created_by ? { created_by: document.created_by } : {}),
    });
    known.push(created);
    linkedVaccineId ??= vaccine.id;
  }

  // One document can feed several series; the pointer records the first (it
  // is primarily the dispatcher's re-run guard — each dose already links back
  // via its own `document` field).
  return linkedVaccineId
    ? { linked_resource: `${VACCINES}/${linkedVaccineId}` }
    : undefined;
};

export default handler;
