/**
 * Documents E2E helpers — upload documents (multipart-file), run the real
 * classify method, and clean up. Seeds through the aepbase REST API per the
 * e2e guidelines; the UI dropzone is exercised only in the one UI-flow test.
 */

import {
  aepCreateMultipart,
  aepList,
  aepRemove,
  postCustomMethod,
} from '../../../../tests/e2e/utils/aepbase-helpers';
import { getAepbaseUrl } from '../../../../tests/e2e/config/aepbase.setup';
import { DOC_MARKERS } from '../../../../tests/e2e/config/ai-stub';

const DOCUMENTS = 'documents';
const OPERATIONS = 'operations';

export interface DocumentRecord {
  id: string;
  title?: string;
  mime_type?: string;
  full_text?: string;
  parse_status?: string;
  confidence?: number;
  metadata?: { doc_type?: string; [k: string]: unknown };
}

interface OperationRecord {
  id: string;
  done: boolean;
  status?: string;
}

/** Which stubbed model reply this upload will elicit (see config/ai-stub.ts). */
export type DocumentKind = keyof typeof DOC_MARKERS;

/**
 * Upload a document. The file's bytes are the marker the AI stub keys on, so a
 * `kind` of `match` parses as a 1099-INT, `unknown` as unrecognised, `fail`
 * throws in the model call. `mimeType` overrides the stored type — pass an
 * unsupported one to exercise the classify pre-flight rejection.
 */
export async function uploadDocument(
  token: string,
  kind: DocumentKind,
  opts: { title?: string; mimeType?: string } = {},
): Promise<DocumentRecord> {
  const mimeType = opts.mimeType ?? 'application/pdf';
  const bytes = new TextEncoder().encode(DOC_MARKERS[kind]);
  const blob = new Blob([bytes], { type: mimeType });

  const resource: Record<string, unknown> = {
    title: opts.title ?? `${kind} document`,
    mime_type: mimeType,
    parse_status: 'pending',
  };

  const formData = new FormData();
  formData.append('resource', JSON.stringify(resource));
  formData.append('file', blob, 'document.pdf');

  return aepCreateMultipart<DocumentRecord>(token, DOCUMENTS, formData);
}

/** Invoke the real classify method on a document; returns its 202 operation. */
export async function classifyDocument(
  token: string,
  id: string,
): Promise<{ status: number; operation?: OperationRecord }> {
  const res = await postCustomMethod(token, `/documents/${id}:classify`);
  if (res.status !== 202) return { status: res.status };
  return { status: 202, operation: (await res.json()) as OperationRecord };
}

/** Upload, classify, and wait for the document to leave `pending`. */
export async function uploadAndClassify(
  token: string,
  kind: DocumentKind,
  opts: { title?: string } = {},
): Promise<DocumentRecord> {
  const doc = await uploadDocument(token, kind, opts);
  await classifyDocument(token, doc.id);
  return waitForParse(token, doc.id);
}

/** Poll a document until its parse settles (anything but `pending`). */
export async function waitForParse(
  token: string,
  id: string,
  timeoutMs = 20_000,
): Promise<DocumentRecord> {
  const deadline = Date.now() + timeoutMs;
  // A short fixed step is fine in a helper — this is not a Playwright auto-wait.
  for (;;) {
    const [doc] = (await aepList<DocumentRecord>(token, DOCUMENTS)).filter((d) => d.id === id);
    if (doc && doc.parse_status !== 'pending') return doc;
    if (Date.now() > deadline) {
      throw new Error(`document ${id} still pending after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

/**
 * List documents matching a filter — exercises the Phase 1 union columns
 * (`metadata.doc_type == …`) end to end. `aepList` can't carry a filter, so this
 * hits the collection directly.
 */
export async function listDocuments(
  token: string,
  filter: string,
): Promise<DocumentRecord[]> {
  const url = `${getAepbaseUrl()}/${DOCUMENTS}?max_page_size=200&filter=${encodeURIComponent(filter)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`filtered list failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { results?: DocumentRecord[] };
  return body.results ?? [];
}

export async function listOperations(token: string): Promise<OperationRecord[]> {
  return aepList<OperationRecord>(token, OPERATIONS);
}

export async function deleteAllDocuments(token: string): Promise<void> {
  for (const doc of await aepList<DocumentRecord>(token, DOCUMENTS)) {
    await aepRemove(token, DOCUMENTS, doc.id).catch(() => {});
  }
}

/** Drop any operations left behind, so a stray `running` one can't spin the bell. */
export async function deleteAllOperations(token: string): Promise<void> {
  for (const op of await aepList<OperationRecord>(token, OPERATIONS)) {
    await aepRemove(token, OPERATIONS, op.id).catch(() => {});
  }
}
