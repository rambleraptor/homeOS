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
import {
  docTypeIds,
  toExtractionSchema,
  UNKNOWN_DOC_TYPE,
  type DocType,
} from '../doc-types/docType';
import { getDocType, getDocTypes } from '../doc-types/registry';
import type { Document } from '../types';

/**
 * Below this, a match is downgraded to `unmatched`: a wrong parse presented as
 * fact is worse than an honest "we couldn't tell", because the metadata looks
 * authoritative in the UI.
 */
const MIN_CONFIDENCE = 0.5;

/**
 * Room for the answer. Generous on purpose — a cap is a ceiling, not a spend
 * (the model stops when it's done), so over-provisioning costs nothing while a
 * truncated extraction loses fields. Shared by both passes; classification's
 * answer is tiny and never approaches it.
 */
const MAX_OUTPUT_TOKENS = 16384;

/** What the model may be handed. Gemini reads PDFs natively, multi-page. */
const SUPPORTED_MIME = /^(application\/pdf|image\/(jpeg|png|webp|gif))$/;

function classifyPrompt(types: DocType[]): string {
  const catalogue = types
    .map((t) => `- ${t.id}: ${t.label} — ${t.description}`)
    .join('\n');

  return `You are reading a scanned or digital household document. Do two things.

1. Write a short, human-readable "title" for the document — what a person would
   name this file so they could find it later.

   Follow one shape: "<Document> — <Subject>". Name the kind of document, then an
   em dash surrounded by spaces (" — "), then the specific person, business,
   issuer, or item it concerns. When the document is tied to a single year (a tax
   form, an annual statement), put that year in parentheses right after the
   document name: "<Document> (<Year>) — <Subject>".

   Match these examples in form and tone:
   - 1099-INT (2024) — Pecan Street Credit Union
   - 1098 (2024) — Lone Star Mortgage
   - Donation Statement (2024) — Central Texas Food Bank
   - Auto Insurance — 2019 Honda Civic
   - Business Owner's Policy — Rivera Design Co
   - Certificate of Marriage — Dana & Sam Rivera
   - Driver's License — Mateo Rivera
   - Apple — Studio Display
   - B&H Photo — 50mm Lens

   Rules:
   - Left of the dash is what the document *is*: the form number, certificate
     name, or policy type — or, for a receipt or invoice, the vendor. Right of the
     dash is who or what it concerns: the issuer, the named person, the insured
     asset, or the purchased item.
   - Use the document's own specifics. Never fall back on generic words like
     "Scan", "Document", "Statement", or "Untitled" on their own.
   - Title Case throughout. No file extension, no surrounding quotes, no trailing
     period. Keep it under about eight words.
   - Drop the dash and the second half only when the document truly has no
     distinct subject.

2. Decide whether it is one of these known document types:

${catalogue || '(no known document types are configured)'}

   Set "doc_type" to the matching id. If it is not clearly one of them, set
   "doc_type" to "${UNKNOWN_DOC_TYPE}". Many documents legitimately match
   nothing — "${UNKNOWN_DOC_TYPE}" is a normal answer, not a failure, and is far
   better than forcing a wrong match.

Also set "confidence" between 0 and 1: how sure you are of the type match. Use a
low value when the document is blurry, cropped, or only loosely resembles a known
type.`;
}

/**
 * The extraction pass runs only after {@link classifyPrompt} has matched a
 * single type, so it names that type and asks for its fields alone — a small,
 * focused schema (see `toExtractionSchema`) rather than every type's fields at
 * once. The field-level guidance rides on each field's schema `describe`; these
 * are the rules that apply across all of them.
 */
function extractPrompt(type: DocType): string {
  return `This document has been identified as: ${type.label} — ${type.description}

Read the document and fill in that type's fields. Rules:
- Copy values exactly as printed. Do not reformat, round, or unmask them.
- Set any field you cannot find to null. Never guess, and never carry a value
  over from a different field just because it looks similar.
- Numbers must have no currency symbols, thousands separators, or percent signs.`;
}

/** Clamp to 0-1: the field is advisory, and a wild value shouldn't poison it. */
function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Drop the fields the model returned as null (its "couldn't find it" signal
 * under the nullable schema), leaving only the values actually read off the
 * document. The caller re-attaches the `doc_type` discriminator afterwards.
 */
function stripNulls(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== null),
  );
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
  // Sent as-is: Gemini reads application/pdf directly, so there's no
  // client-side rasterisation and no first-page-only limit.
  const mediaType = doc.mime_type || 'application/pdf';

  // Pair an instruction with the document as one user message. Each pass builds
  // its own — the document is re-sent so the extraction pass sees the pages too,
  // not just the classification's verdict.
  const withDocument = (text: string): ModelMessage[] => [
    {
      role: 'user',
      content: [
        { type: 'text', text },
        { type: 'file', data: base64, mediaType },
      ],
    },
  ];

  // Shared failure path: pin it to the concrete input, mark the document failed
  // (the list view reads parse_status; the operation carries the detail), and
  // rethrow. `aiGenerateObject` already logs the provider's raw response; the
  // `pass` says which call it belongs to.
  const failClassify = async (err: unknown, pass: string): Promise<never> => {
    console.error(
      `[documents] classify ${pass} failed for ${docId} ` +
        `(mime=${doc.mime_type ?? 'unknown'}, bytes=${bytes.length}, doc_types=${types.length})`,
    );
    await aepUpdate<Document>(DOCUMENTS, docId, { parse_status: 'failed' }, auth.token);
    throw err;
  };

  // Pass 1 — classification. A deliberately tiny schema: a title, a confidence,
  // and the type id as an enum. It carries none of the types' fields, so it
  // stays small however many types are configured — the whole point of the
  // split (see docTypeIds/toExtractionSchema). Extraction is pass 2 below.
  const classifySchema = z.object({
    title: z.string().describe('A short, human-readable title for the document.'),
    confidence: z.number().describe('Confidence in the type match, 0 to 1.'),
    doc_type: z
      .enum(docTypeIds(types))
      .describe(`The matching document type id, or "${UNKNOWN_DOC_TYPE}" if none.`),
  });

  let classified: z.infer<typeof classifySchema>;
  try {
    classified = await aiGenerateObject({
      messages: withDocument(classifyPrompt(types)),
      schema: classifySchema,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
  } catch (err) {
    return failClassify(err, 'classification');
  }

  const confidence = clampConfidence(classified.confidence);
  const matched =
    classified.doc_type !== UNKNOWN_DOC_TYPE && confidence >= MIN_CONFIDENCE;

  // Pass 2 — extraction, only when a type matched. The schema is that single
  // type's fields (small, and focused on the fields this document has), and the
  // document is re-sent so the model reads it, not the pass-1 verdict. The model
  // fills every field, using null for the ones it couldn't find (the fields are
  // `.nullable()`, not `.optional()`, to keep Gemini from aborting — see
  // toExtractionSchema). Drop the nulls so the stored record carries only real
  // values, and re-attach the discriminator. Unmatched documents (including a
  // low-confidence guess, downgraded rather than stored as a match) skip the
  // pass entirely and carry only the unknown tag. (The document's text is
  // extracted separately by the platform index pipeline into `file_text`,
  // independent of this classification.)
  let metadata: { doc_type: string; [field: string]: unknown } = {
    doc_type: UNKNOWN_DOC_TYPE,
  };
  if (matched) {
    const matchedType = getDocType(classified.doc_type)!;
    let extracted: Record<string, unknown>;
    try {
      extracted = await aiGenerateObject({
        messages: withDocument(extractPrompt(matchedType)),
        schema: toExtractionSchema(matchedType),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
    } catch (err) {
      return failClassify(err, 'extraction');
    }
    metadata = { ...stripNulls(extracted), doc_type: classified.doc_type };
  }

  // Only adopt the inferred title when a human hasn't renamed the document.
  // A blank model title never clobbers the existing (filename) default.
  const inferredTitle = classified.title?.trim();
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
