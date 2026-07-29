/**
 * Client-side duplicate detection for hand-uploaded documents.
 *
 * Hand-uploads store the file first and get their `content_hash` stamped by the
 * server (the file-index gateway trigger), so the hash appears on a later list
 * refetch — which the documents list already polls for while a document is
 * pending. Once it's there, a just-uploaded document that shares a hash with an
 * earlier one is a duplicate: this maps those uploads to the original so the UI
 * can warn softly (unlike the email flow, hand-uploads aren't blocked).
 */

import type { Document } from './types';

export interface DuplicateUpload {
  /** The document the user just uploaded. */
  upload: Document;
  /** The earliest existing document with identical content. */
  original: Document;
}

/**
 * For each just-uploaded id, find an earlier document with the same
 * `content_hash`. An upload that is itself the earliest of its content group is
 * the original and isn't flagged; a copy points at whichever document was filed
 * first. Uploads whose hash hasn't been stamped yet are skipped (they surface on
 * a later poll once the server records the hash).
 */
export function findDuplicateUploads(
  documents: Document[],
  uploadedIds: readonly string[],
): DuplicateUpload[] {
  const out: DuplicateUpload[] = [];
  for (const id of uploadedIds) {
    const upload = documents.find((d) => d.id === id);
    if (!upload?.content_hash) continue;

    const group = documents.filter((d) => d.content_hash === upload.content_hash);
    if (group.length < 2) continue;

    // Earliest by create_time wins the tie deterministically (reduce keeps the
    // incumbent on `<=`), so re-uploading a copy always points at the first one.
    const original = group.reduce((earliest, d) =>
      (earliest.create_time ?? '') <= (d.create_time ?? '') ? earliest : d,
    );
    if (original.id === upload.id) continue; // this upload is the original

    out.push({ upload, original });
  }
  return out;
}
