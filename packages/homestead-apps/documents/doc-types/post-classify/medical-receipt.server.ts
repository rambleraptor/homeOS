/**
 * post_classify hook for the `medical-receipt` doc type.
 *
 * When a document is classified as a medical receipt, mirror it into the HSA
 * Receipts app so the expense shows up there for reimbursement tracking. The
 * document already stores the file, so the created `hsa-receipt` carries no file
 * of its own — it links back via `source_document` (see hsa/resources.ts, where
 * `receipt_file` is optional for exactly this case).
 *
 * Server-only (`.server.ts`): the client build stubs this module, so its
 * cross-app import and the aepbase helper never reach the browser bundle. It is
 * only ever reached through the lazy `post_classify` thunk on the doc type.
 */

import { serverClient } from '@rambleraptor/homestead-core/server/client';
import type { PostClassifyHandler } from '../docType';
import { DOCUMENTS } from '../../resources';
import { HSA_RECEIPTS } from '../../../hsa/resources';
import type { HSAReceipt, ReceiptCategory } from '../../../hsa/types';
import { PEOPLE } from '../../../people/resources';
import type { Person } from '../../../people/types';
import { matchPersonByName } from '../../../people/utils/matchPerson';

/** The HSA receipt categories, as the enum the resource declares. */
const HSA_CATEGORIES: ReceiptCategory[] = ['Medical', 'Dental', 'Vision', 'Rx'];

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Coerce the receipt's printed date to a date-time string (the field's format).
 * The model records the date as printed — often `YYYY-MM-DD` — so widen it to a
 * parseable instant; fall back to the document's own timestamps if it's absent
 * or unreadable, since `service_date` is required on the HSA receipt.
 */
function toDateTime(printed: string | undefined, fallback: string): string {
  if (printed) {
    const parsed = new Date(printed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return fallback;
}

/**
 * Resolve a printed patient name to a canonical `person` record, so a
 * document-created receipt links to a person the same way the quick-capture
 * form does (via `matchPersonByName`) rather than only carrying the free-text
 * `patient`. Best-effort enrichment: an unreadable people list, or a name that
 * matches zero or more than one person, just leaves the receipt with its
 * patient string — never blocks receipt creation.
 */
async function resolvePersonPath(
  name: string,
  token: string,
): Promise<string | undefined> {
  try {
    const people = await serverClient(token).collection<Person>(PEOPLE).listAll();
    // Empty `aliases` may come back absent; `matchPersonByName` spreads it.
    const normalized = people.map((p) => ({ ...p, aliases: p.aliases ?? [] }));
    const matched = matchPersonByName(name, normalized);
    return matched ? `${PEOPLE}/${matched.id}` : undefined;
  } catch {
    return undefined;
  }
}

/** Fold the receipt-content fields the HSA schema has no column for into notes. */
function receiptNotes(m: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  const items = asString(m.items);
  const payment = asString(m.payment_method);
  const tax = asNumber(m.tax);
  if (items) parts.push(`Items: ${items}`);
  if (payment) parts.push(`Paid by: ${payment}`);
  if (tax !== undefined) parts.push(`Tax: ${tax}`);
  return parts.length ? parts.join('\n') : undefined;
}

const handler: PostClassifyHandler = async ({ document, metadata, auth }) => {
  const category = asString(metadata.category);
  const fallbackDate =
    document.create_time ?? document.update_time ?? new Date().toISOString();

  const receipt: Record<string, unknown> = {
    merchant: asString(metadata.merchant) ?? document.title ?? 'Unknown merchant',
    service_date: toDateTime(asString(metadata.purchase_date), fallbackDate),
    amount: asNumber(metadata.amount_paid) ?? 0,
    category:
      category && (HSA_CATEGORIES as string[]).includes(category)
        ? category
        : 'Medical',
    status: 'Stored',
    source_document: `${DOCUMENTS}/${document.id}`,
  };
  const patient = asString(metadata.patient);
  if (patient) {
    receipt.patient = patient;
    const personPath = await resolvePersonPath(patient, auth.token);
    if (personPath) receipt.person = personPath;
  }
  const notes = receiptNotes(metadata);
  if (notes) receipt.notes = notes;
  if (document.created_by) receipt.created_by = document.created_by;

  const created = await serverClient(auth.token)
    .collection<HSAReceipt>(HSA_RECEIPTS)
    .create(receipt);
  return { linked_resource: `${HSA_RECEIPTS}/${created.id}` };
};

export default handler;
