/**
 * Inline preview of a document's file on its detail page: an <img> for images,
 * an embedded <iframe> for PDFs and plain text (e.g. an ingested email body),
 * and a graceful fallback (download prompt) for anything else or while the
 * bytes are still resolving. Fetches the file once via the shared blob-URL hook.
 */

import { ExternalLink, FileQuestion } from 'lucide-react';
import { Skeleton } from '@rambleraptor/homestead-core/shared/components/Skeleton';
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
    // The preview's size is known before its bytes are — it is always the same
    // 70vh frame — so the wait reserves that box rather than centring a spinner
    // in it and letting the page reflow when the file lands.
    return (
      <div className={frame} data-testid="document-viewer-loading">
        <Skeleton className="h-[70vh] w-full rounded-none" />
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

  if (kind === 'text') {
    // A text/plain blob URL renders inertly in an iframe — the browser shows
    // the raw text (an ingested email body, a .txt upload) with no styling and
    // no script execution.
    return (
      <div className={frame} data-testid="document-viewer">
        <iframe
          src={url}
          title={document.title || 'Document preview'}
          sandbox=""
          className="h-[70vh] w-full bg-surface-white"
        />
      </div>
    );
  }

  if (kind === 'pdf') {
    return (
      <div className="space-y-2">
        <div className={frame} data-testid="document-viewer">
          <iframe
            src={url}
            title={document.title || 'Document preview'}
            className="h-[70vh] w-full"
          />
        </div>
        {/* Phone browsers give an embedded PDF very little room (and iOS shows
            only its first page), so offer the full-screen view alongside it. */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-brand-slate"
          data-testid="document-viewer-open"
        >
          <ExternalLink className="h-4 w-4" />
          Open full screen
        </a>
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
