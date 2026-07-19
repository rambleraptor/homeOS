/**
 * The generic "index a file field" pipeline — the platform-level equivalent of
 * the documents app's `classify`, but for any resource's `ai`-enabled file
 * field. Triggered behind the scenes by the `/api/aep` gateway on upload (see
 * `homestead-server/src/routes/aep-gateway.ts`), it:
 *
 *   1. downloads the stored file (over loopback, as the caller),
 *   2. extracts its full text (a vision model for PDFs/images; a plain decode
 *      for text files) into the companion `<field>_text` field,
 *   3. if the field embeds, chunks the text, embeds each chunk, and replaces the
 *      field's vectors in the store.
 *
 * The (record, field) pair is the unit of work: one call indexes exactly one
 * file field of one record.
 */

import { z } from 'zod';
import { aepDownload, aepUpdate } from '../aepbase';
import { isAiConfigured } from '../ai/config';
import { aiEmbed, aiGenerateObject, type ModelMessage } from '../ai/generate';
import { companionTextField } from '../../resources/ai-fields';
import type { EmbedOptions } from '../../resources/types';
import { chunkText } from './chunk';
import { getVectorStore } from './store';
import type { FieldScope, VectorChunk } from './types';

/**
 * Chunk, embed, and store `text` for one (record, field), replacing any existing
 * vectors. Empty text purges the field's vectors instead. Returns the number of
 * chunks stored. Shared by {@link indexFile} (on upload) and the documents
 * backfill (re-embedding already-extracted text without a fresh vision call).
 */
export async function embedTextIntoStore(
  scope: FieldScope,
  text: string,
  embed: Required<EmbedOptions>,
): Promise<number> {
  const store = getVectorStore();
  if (!store) return 0;
  if (!text) {
    await store.purge(scope);
    return 0;
  }
  const pieces = chunkText(text, embed);
  const vectors = await aiEmbed(pieces, { model: embed.embedding_model || undefined });
  const chunks: VectorChunk[] = pieces.map((piece, i) => ({
    chunk: i,
    text: piece,
    vector: vectors[i],
  }));
  await store.replace(scope, chunks);
  return chunks.length;
}

/** Magic-number → media type for the file kinds the vision model can read. */
function sniffMediaType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return 'application/pdf'; // %PDF
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return 'image/jpeg';
  }
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return 'image/png';
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) {
    return 'image/webp';
  }
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) {
    return 'image/gif'; // GIF8
  }
  return null;
}

/** Heuristic: are these bytes plausibly UTF-8 text (no NULs, mostly printable)? */
function looksLikeText(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 4096);
  if (n === 0) return false;
  let control = 0;
  for (let i = 0; i < n; i++) {
    const c = bytes[i];
    if (c === 0) return false; // NUL → binary
    // Allow tab/newline/carriage-return; count other C0 controls.
    if (c < 0x09 || (c > 0x0d && c < 0x20)) control++;
  }
  return control / n < 0.1;
}

const EXTRACT_PROMPT =
  "Transcribe this document's full text verbatim into \"text\". Include every " +
  'page in reading order. Preserve line breaks and labels; do not summarize, ' +
  'correct, translate, or reorder anything. If the document has no readable ' +
  'text, return an empty string.';

/** Pull the file's full text: vision model for pdf/image, decode for text. */
async function extractText(bytes: Uint8Array): Promise<string> {
  const mediaType = sniffMediaType(bytes);
  if (!mediaType) {
    if (looksLikeText(bytes)) return new TextDecoder().decode(bytes).trim();
    // Unknown binary we can't read — nothing to index.
    return '';
  }
  if (!isAiConfigured()) {
    throw new Error('AI is not configured — cannot extract text from this file');
  }
  const base64 = Buffer.from(bytes).toString('base64');
  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: EXTRACT_PROMPT },
        { type: 'file', data: base64, mediaType },
      ],
    },
  ];
  const { text } = await aiGenerateObject({
    messages,
    schema: z.object({ text: z.string().describe('The full text, verbatim.') }),
  });
  return text.trim();
}

export interface IndexFileInput {
  /** Resource singular, e.g. `document`. */
  resource: string;
  /** Resource plural, for the loopback aep calls, e.g. `documents`. */
  plural: string;
  /** Record id. */
  record: string;
  /** File field name, e.g. `file`. */
  field: string;
  /** Resolved embed options, or null when the field only extracts text. */
  embed: Required<EmbedOptions> | null;
  /** Caller's bearer token — the pipeline acts as the uploader. */
  token: string;
}

export interface IndexFileResult {
  field: string;
  /** Characters of text extracted. */
  chars: number;
  /** Chunks embedded and stored (0 when the field doesn't embed). */
  chunks: number;
}

/**
 * Run the extract → store-text → (chunk → embed → index) pipeline for one file
 * field. Throws on hard failures (download, extraction, embedding); the caller
 * (the gateway trigger) records that on the operation.
 */
export async function indexFile(input: IndexFileInput): Promise<IndexFileResult> {
  const { resource, plural, record, field, embed, token } = input;

  const res = await aepDownload(plural, record, field, token);
  if (!res.ok) {
    throw new Error(`could not read ${plural}/${record} field "${field}": ${res.status}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());

  const text = await extractText(bytes);

  // Store the extracted text on the companion field regardless of embedding, so
  // it's displayable and the chat model can read the whole document.
  await aepUpdate(plural, record, { [companionTextField(field)]: text }, token);

  if (!embed) {
    return { field, chars: text.length, chunks: 0 };
  }
  // Embeds the text (or purges vectors when empty); no-ops if the store is
  // unwired (embedding provider unconfigured). Text is already stored above.
  const chunks = await embedTextIntoStore({ resource, record, field }, text, embed);
  return { field, chars: text.length, chunks };
}
