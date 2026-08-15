/**
 * Resolve a document's stored `file` field to a blob URL the browser can render
 * inline (an `<img>` for images, an `<iframe>` for PDFs). Thin wrapper over the
 * shared `useFileFieldUrl`, so the bytes are fetched once and revoked on unmount.
 *
 * The document's recorded `mime_type` is handed to the hook so the blob URL
 * carries the real type: `:download` answers `application/octet-stream`, and a
 * PDF blob URL labelled that way makes the browser download the file (mobile
 * browsers navigate the whole page to an "unknown type" download) instead of
 * rendering it in the viewer's iframe.
 */

import { useFileFieldUrl } from '@rambleraptor/homestead-core/api/resourceHooks';
import { DOCUMENTS } from '../resources';
import type { Document } from '../types';

export function useDocumentFileUrl(doc: Document | null | undefined): string | null {
  return useFileFieldUrl(DOCUMENTS, doc?.id, 'file', doc?.file, {
    type: doc?.mime_type,
  });
}
