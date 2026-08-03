/**
 * `documents/{id}:reembed` — migration support for the `full_text → file_text`
 * backfill.
 *
 * For one document, copies legacy `full_text` into the `file_text` companion (if
 * not already set) and embeds that text into the vector store — reusing the
 * already-extracted text, so it costs an embedding call but no vision call. The
 * one-off backfill script (scripts/backfill-document-embeddings.sh) calls this
 * per document. Safe to delete once every instance has been migrated and the
 * legacy `full_text` field is removed.
 */

import type { CustomMethodHandler } from '@rambleraptor/homestead-core/resources/types';
import { isEmbeddingConfigured } from '@rambleraptor/homestead-core/server/ai/config';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import { embedTextIntoStore } from '@rambleraptor/homestead-core/server/vectors/index-file';
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_OVERLAP,
} from '@rambleraptor/homestead-core/resources/ai-fields';
import { DOCUMENTS } from '../resources';
import type { Document } from '../types';

const handler: CustomMethodHandler = async ({ id, auth }) => {
  if (!isEmbeddingConfigured()) {
    return Response.json(
      { error: 'Service unavailable', message: 'Embedding is not configured on the server' },
      { status: 503 },
    );
  }
  if (!id) {
    return Response.json(
      { error: 'Bad request', message: 'reembed is addressed on a single document' },
      { status: 400 },
    );
  }

  const documents = serverClient(auth.token).collection<Document>(DOCUMENTS);

  let doc: Document;
  try {
    doc = await documents.get(id);
  } catch {
    return Response.json(
      { error: 'Not found', message: `document ${id} not found` },
      { status: 404 },
    );
  }

  const text = (doc.file_text ?? doc.full_text ?? '').trim();

  // Bring the companion up to date if it's still empty but legacy text exists.
  if (text && doc.file_text !== text) {
    await documents.record(id).update({ file_text: text });
  }

  const chunks = await embedTextIntoStore(
    { resource: 'document', record: id, field: 'file' },
    text,
    { chunk_size: DEFAULT_CHUNK_SIZE, overlap: DEFAULT_OVERLAP, embedding_model: '' },
  );

  return Response.json({ id, chars: text.length, chunks });
};

export default handler;
