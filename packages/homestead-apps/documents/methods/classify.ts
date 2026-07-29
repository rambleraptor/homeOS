/**
 * `documents/{id}:classify` async custom method (AEP-136 + AEP-151).
 *
 * Reads the *stored* file rather than taking bytes in the body: the method is
 * item-scoped, so it has the record id and can pull the file back over loopback
 * with the caller's token (no need for the caller to base64 the bytes into the
 * request, as a collection-scoped method with no record yet would have to).
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
import { getDocType, getDocTypes } from '../doc-types/registry';
import type { Document } from '../types';

/**
 * Below this, a match is downgraded to `unmatched`: a wrong parse presented as
 * fact is worse than an honest "we couldn't tell", because the metadata looks
 * authoritative in the UI.
 */
const MIN_CONFIDENCE = 0.5;

/**
 * Room for the answer: a full-document transcription plus the extracted fields.
 * Generous on purpose — the alternative to over-provisioning is a truncated
 * `full_text`, which is worse than spending a few extra tokens.
 */
const MAX_OUTPUT_TOKENS = 16384;

/** What the model may be handed. Gemini reads PDFs natively, multi-page. */
const SUPPORTED_MIME = /^(application\/pdf|image\/(jpeg|png|webp|gif))$/;

function classifyPrompt(types: DocType[]): string {
  const catalogue = types
    .map((t) => `- ${t.id}: ${t.label} — ${t.description}`)
    .join('\n');

  return `You are reading a scanned or digital household document. Do three things.

1. Write a short, human-readable "title" for the document — what a person would
   name this file so they could find it later. Prefer concrete specifics from the
   document (issuer, form name, date, or subject) over generic words, e.g.
   "2024 Ally Bank 1099-INT" or "March PG&E electricity bill". Keep it under about
   eight words, with no file extension and no surrounding quotes.

2. Decide whether it is one of these known document types:

${catalogue || '(no known document types are configured)'}

   Set metadata.doc_type to the matching id. If it is not clearly one of them,
   set metadata.doc_type to "${UNKNOWN_DOC_TYPE}". Many documents legitimately
   match nothing — "${UNKNOWN_DOC_TYPE}" is a normal answer, not a failure, and is
   far better than forcing a wrong match.

3. If it matched a type, fill that type's fields from the document. Rules:
   - Copy values exactly as printed. Do not reformat, round, or unmask them.
   - Set any field you cannot find to null. Never guess, and never carry a value
     over from a different field just because it looks similar.
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

/**
 * Drop the fields the model returned as null (its "couldn't find it" signal
 * under the nullable schema), leaving only the values actually read off the
 * document. `doc_type` is never null, so the discriminator always survives.
 */
function stripNulls<T extends { doc_type: string }>(
  metadata: T,
): Partial<T> & { doc_type: T['doc_type'] } {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== null),
  ) as Partial<T> & { doc_type: T['doc_type'] };
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
  const bytes = Buffer.from(await res.arrayBuffer());
  const base64 = bytes.toString('base64');

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
    title: z.string().describe('A short, human-readable title for the document.'),
    confidence: z.number().describe('Confidence in the type match, 0 to 1.'),
    metadata: toZodUnion(types),
  });

  let parsed: z.infer<typeof schema>;
  try {
    parsed = await aiGenerateObject({
      messages,
      schema,
      // A full transcription plus the extracted fields is legitimately long, so
      // give the answer plenty of room. (The metadata fields are `.nullable()`,
      // not `.optional()` — see toZodUnion; that is what keeps Gemini 2.5 Flash
      // from aborting the structured-output call with finishReason "OTHER".)
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
  } catch (err) {
    // Pin the failure to the concrete input: which document, what shape, and how
    // many type branches the schema carried. `aiGenerateObject` already logs the
    // provider's raw response; this says which classify call it belongs to.
    console.error(
      `[documents] classify failed for ${docId} ` +
        `(mime=${doc.mime_type ?? 'unknown'}, bytes=${bytes.length}, doc_types=${types.length})`,
    );
    // Record the failure on the document too — the operation carries the detail,
    // but the list view reads parse_status.
    await aepUpdate<Document>(DOCUMENTS, docId, { parse_status: 'failed' }, auth.token);
    throw err;
  }

  const confidence = clampConfidence(parsed.confidence);
  const matched =
    parsed.metadata.doc_type !== UNKNOWN_DOC_TYPE && confidence >= MIN_CONFIDENCE;

  // The model fills every field, using null for the ones it couldn't find (the
  // schema is `.nullable()`, not `.optional()`, to keep Gemini from aborting —
  // see toZodUnion). Drop the nulls so the stored record carries only real
  // values, matching what an "omit what you can't find" schema would have left.
  // A low-confidence guess is downgraded rather than stored as a match. (The
  // document's text is extracted separately by the platform index pipeline into
  // `file_text`, independent of this classification.)
  const metadata = matched ? stripNulls(parsed.metadata) : { doc_type: UNKNOWN_DOC_TYPE };

  // Only adopt the inferred title when a human hasn't renamed the document.
  // A blank model title never clobbers the existing (filename) default.
  const inferredTitle = parsed.title?.trim();
  const setTitle = !doc.title_edited && inferredTitle ? { title: inferredTitle } : {};

  const updated = await aepUpdate<Document>(
    DOCUMENTS,
    docId,
    {
      ...setTitle,
      confidence,
      metadata,
      parse_status: matched ? 'parsed' : 'unmatched',
    },
    auth.token,
  );

  // Fire the matched type's post-classify hook, if any. Guarded on `matched`
  // and on the document not already carrying a link, so a re-run ("Read again")
  // doesn't create a second downstream resource. A hook failure is logged but
  // never fails the classification — the parse itself already succeeded.
  if (matched && !doc.linked_resource) {
    const docType = getDocType(metadata.doc_type);
    if (docType?.post_classify) {
      try {
        const { default: hook } = await docType.post_classify();
        const result = await hook({ document: updated, metadata, auth });
        if (result?.linked_resource) {
          await aepUpdate<Document>(
            DOCUMENTS,
            docId,
            { linked_resource: result.linked_resource },
            auth.token,
          );
        }
      } catch (err) {
        console.error(
          `[documents] post_classify failed for ${docId} (${metadata.doc_type})`,
          err,
        );
      }
    }
  }

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
