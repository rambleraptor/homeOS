/**
 * Resolve a document's stored `file` field to a blob URL the browser can render
 * inline (an `<img>` for images, an `<iframe>` for PDFs). Thin wrapper over the
 * shared `useFileFieldUrl`, so the bytes are fetched once and revoked on unmount.
 */

import { useFileFieldUrl } from '@rambleraptor/homestead-core/api/resourceHooks';
import { DOCUMENTS } from '../resources';
import type { Document } from '../types';

export function useDocumentFileUrl(doc: Document | null | undefined): string | null {
  return useFileFieldUrl(DOCUMENTS, doc?.id, 'file', doc?.file);
}
