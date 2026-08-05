/**
 * Parse the optional `doc_type` override out of a `classify` request body.
 *
 * `classify` is normally called with an empty body and picks the type itself
 * (pass 1). A caller may instead pass `{ "doc_type": "<id>" }` to *force* the
 * type — the handler then skips pass 1 and runs only the extraction pass (pass
 * 2) for that type, so a human's authoritative type choice still gets its fields
 * AI-filled (the win over hand-editing the metadata). This override is the
 * method's whole body contract, so it lives in its own pure module: no server,
 * AI, or client imports, which keeps it unit-testable and lets both `validate`
 * and the handler share one parse.
 *
 * Three outcomes:
 *   - `none`    — no override: a blank, absent, or non-JSON body (today's call),
 *                 or a JSON object without a `doc_type` key. Automatic pass-1
 *                 classification runs.
 *   - `forced`  — a `doc_type` naming a known type. Skip pass 1.
 *   - `invalid` — a `doc_type` that is present but unusable (wrong JSON type,
 *                 empty, the reserved `unknown`, or an unregistered id).
 *                 `validate` turns this into a 400 before any operation starts.
 */

import { getDocType } from '../doc-types/registry';
import { UNKNOWN_DOC_TYPE } from '../doc-types/docType';

export type ForcedDocType =
  | { kind: 'none' }
  | { kind: 'forced'; docType: string }
  | { kind: 'invalid'; message: string };

/**
 * Typed against just the `text()` reader so a test can pass a lightweight stub
 * without a global `Request`; the real caller hands in the dispatcher's
 * replayable `Request`, which satisfies it.
 */
export async function parseForcedDocType(
  request: Pick<Request, 'text'>,
): Promise<ForcedDocType> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    // A body we can't read is treated as no override, the same as an empty one.
    return { kind: 'none' };
  }
  if (!text.trim()) return { kind: 'none' };

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    // Callers have always sent no body (or `{}`); tolerate a non-JSON one rather
    // than failing a call that never meant to force anything.
    return { kind: 'none' };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { kind: 'none' };

  const value = (body as Record<string, unknown>).doc_type;
  if (value === undefined || value === null) return { kind: 'none' };
  if (typeof value !== 'string' || !value.trim()) {
    return { kind: 'invalid', message: 'doc_type must be a non-empty string' };
  }

  const id = value.trim();
  if (id === UNKNOWN_DOC_TYPE) {
    return {
      kind: 'invalid',
      message:
        `doc_type "${UNKNOWN_DOC_TYPE}" cannot be forced — omit doc_type to run ` +
        'automatic classification',
    };
  }
  if (!getDocType(id)) {
    return { kind: 'invalid', message: `unknown doc_type "${id}"` };
  }
  return { kind: 'forced', docType: id };
}
