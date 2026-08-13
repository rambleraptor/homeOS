/**
 * Inline preview of a document's file on its detail page: an <img> for images,
 * an embedded <iframe> for PDFs, and a graceful fallback (download prompt) for
 * anything else or while the bytes are still resolving. Fetches the file once
 * via the shared blob-URL hook.
 */

import { FileQuestion, Loader2 } from 'lucide-react';
import { useDocumentFileUrl } from '../hooks/useDocumentFileUrl';
import { fileKind } from '../fileKind';
import type { Document } from '../types';

export function DocumentViewer({ document }: { document: Document }) {
  const url = useDocumentFileUrl(document);
  const kind = fileKind(document.mime_type);

  const frame =
    'overflow-hidden rounded-2xl border border-gray-100 bg-surface-white shadow-sm';

  if (!document.file) {
    return (
      <div
        className={`${frame} flex h-64 flex-col items-center justify-center gap-2 text-center`}
        data-testid="document-viewer-empty"
      >
        <FileQuestion className="h-8 w-8 text-gray-300" />
        <p className="text-sm text-text-muted">No file attached to this document.</p>
      </div>
    );
  }

  if (!url) {
    return (
      <div className={`${frame} flex h-[70vh] items-center justify-center`}>
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    );
  }

  if (kind === 'image') {
    return (
      <div className={`${frame} bg-gray-50 p-2`} data-testid="document-viewer">
        <img
          src={url}
          alt={document.title || 'Document preview'}
          className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain"
        />
      </div>
    );
  }

  if (kind === 'pdf') {
    return (
      <div className={frame} data-testid="document-viewer">
        <iframe
          src={url}
          title={document.title || 'Document preview'}
          className="h-[70vh] w-full"
        />
      </div>
    );
  }

  return (
    <div
      className={`${frame} flex h-64 flex-col items-center justify-center gap-2 text-center`}
      data-testid="document-viewer"
    >
      <FileQuestion className="h-8 w-8 text-gray-300" />
      <p className="text-sm text-text-muted">
        This file type can&rsquo;t be previewed here — use Download to open it.
      </p>
    </div>
  );
}
