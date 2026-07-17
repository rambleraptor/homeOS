/**
 * `documents/{id}:classify` async custom method (AEP-136 + AEP-151).
 *
 * Reads the *stored* file rather than taking bytes in the body: the method is
 * item-scoped, so it has the record id and can pull the file back over loopback
 * with the caller's token. (HSA's parse-receipt base64s the image into the
 * request because its method is collection-scoped and has no record yet.)
 *
 * Long-running: one vision call over a whole document is slow, so the call
 * returns 202 with an Operation and the work runs in the background. The
 * handler PATCHes the record itself — the operation records progress and
 * failure, it isn't the delivery mechanism.
 *
 * Preconditions live in `validate`, which runs before an Operation exists, so a
 * bad call gets a plain 4xx/503 rather than a 202 followed by a failed op.
 */

import { z } from 'zod';
import type {
  AsyncCustomMethodHandler,
  AsyncCustomMethodValidator,
} from '@rambleraptor/homestead-core/resources/types';
import { isAiConfigured } from '@rambleraptor/homestead-core/server/ai/config';
import {
  aiGenerateObject,
  type ModelMessage,
} from '@rambleraptor/homestead-core/server/ai/generate';
import {
  aepDownload,
  aepGet,
  aepUpdate,
} from '@rambleraptor/homestead-core/server/aepbase';
import { DOCUMENTS } from '../resources';
import { toZodUnion, UNKNOWN_DOC_TYPE, type DocType } from '../doc-types/docType';
import { getDocTypes } from '../doc-types/registry';
import type { Document } from '../types';

/**
 * Below this, a match is downgraded to `unmatched`: a wrong parse presented as
 * fact is worse than an honest "we couldn't tell", because the metadata looks
 * authoritative in the UI.
 */
const MIN_CONFIDENCE = 0.5;

/** What the model may be handed. Gemini reads PDFs natively, multi-page. */
const SUPPORTED_MIME = /^(application\/pdf|image\/(jpeg|png|webp|gif))$/;

function classifyPrompt(types: DocType[]): string {
  const catalogue = types
    .map((t) => `- ${t.id}: ${t.label} — ${t.description}`)
    .join('\n');

  return `You are reading a scanned or digital household document. Do three things.

1. Transcribe the document's full text into "full_text". Include every page, in
   reading order. Preserve line breaks and box labels; do not summarise, correct,
   or reorder anything.

2. Decide whether it is one of these known document types:

${catalogue || '(no known document types are configured)'}

   Set metadata.doc_type to the matching id. If it is not clearly one of them,
   set metadata.doc_type to "${UNKNOWN_DOC_TYPE}". Many documents legitimately
   match nothing — "${UNKNOWN_DOC_TYPE}" is a normal answer, not a failure, and is
   far better than forcing a wrong match.

3. If it matched a type, fill that type's fields from the document. Rules:
   - Copy values exactly as printed. Do not reformat, round, or unmask them.
   - Omit any field you cannot find. Never guess, and never carry a value over
     from a different field just because it looks similar.
   - Numbers must have no currency symbols, thousands separators, or percent
     signs.

Also set "confidence" between 0 and 1: how sure you are of the type match. Use a
low value when the document is blurry, cropped, or only loosely resembles a known
type.`;
}

/** Clamp to 0-1: the field is advisory, and a wild value shouldn't poison it. */
function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export const validate: AsyncCustomMethodValidator = async ({ id, auth }) => {
  if (!isAiConfigured()) {
    return Response.json(
      { error: 'Service unavailable', message: 'AI is not configured on the server' },
      { status: 503 },
    );
  }
  if (!id) {
    return Response.json(
      { error: 'Bad request', message: 'classify is addressed on a single document' },
      { status: 400 },
    );
  }

  // Fetch up front so a missing record is a 404 rather than a failed operation.
  let doc: Document;
  try {
    doc = await aepGet<Document>(DOCUMENTS, id, auth.token);
  } catch {
    return Response.json(
      { error: 'Not found', message: `document ${id} not found` },
      { status: 404 },
    );
  }
  if (doc.mime_type && !SUPPORTED_MIME.test(doc.mime_type)) {
    return Response.json(
      {
        error: 'Bad request',
        message: `unsupported file type "${doc.mime_type}" — expected a PDF or an image`,
      },
      { status: 400 },
    );
  }
};

const handler: AsyncCustomMethodHandler = async ({ id, auth }) => {
  const docId = id!;
  const types = getDocTypes();
  const doc = await aepGet<Document>(DOCUMENTS, docId, auth.token);

  // The stored bytes, pulled back over loopback as the caller.
  const res = await aepDownload(DOCUMENTS, docId, 'file', auth.token);
  if (!res.ok) {
    throw new Error(`could not read the document's file: ${res.status}`);
  }
  const base64 = Buffer.from(await res.arrayBuffer()).toString('base64');

  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: classifyPrompt(types) },
        // Sent as-is: Gemini reads application/pdf directly, so there's no
        // client-side rasterisation and no first-page-only limit.
        { type: 'file', data: base64, mediaType: doc.mime_type || 'application/pdf' },
      ],
    },
  ];

  const schema = z.object({
    full_text: z.string().describe("The document's full text, verbatim."),
    confidence: z.number().describe('Confidence in the type match, 0 to 1.'),
    metadata: toZodUnion(types),
  });

  let parsed: z.infer<typeof schema>;
  try {
    parsed = await aiGenerateObject({ messages, schema });
  } catch (err) {
    // Record the failure on the document too — the operation carries the detail,
    // but the list view reads parse_status.
    await aepUpdate<Document>(DOCUMENTS, docId, { parse_status: 'failed' }, auth.token);
    throw err;
  }

  const confidence = clampConfidence(parsed.confidence);
  const matched =
    parsed.metadata.doc_type !== UNKNOWN_DOC_TYPE && confidence >= MIN_CONFIDENCE;

  // A low-confidence guess is downgraded rather than stored as a match: keep the
  // text (always useful) and drop the metadata claim.
  const metadata = matched ? parsed.metadata : { doc_type: UNKNOWN_DOC_TYPE };

  await aepUpdate<Document>(
    DOCUMENTS,
    docId,
    {
      full_text: parsed.full_text,
      confidence,
      metadata,
      parse_status: matched ? 'parsed' : 'unmatched',
    },
    auth.token,
  );

  return {
    doc_type: metadata.doc_type,
    confidence,
    parse_status: matched ? 'parsed' : 'unmatched',
    message: matched
      ? `Matched ${metadata.doc_type}`
      : 'No known document type matched',
  };
};

export default handler;
