/**
 * The square glyph at the start of a document row. It gives the list a visual
 * anchor without fetching every file: a matched document shows its doc-type
 * icon tinted with its category's colour (tax amber, medical teal, …),
 * otherwise a MIME-based file glyph (PDF / image / generic). Cheap and
 * consistent — the real page preview lives on the detail page.
 *
 * The doc-type icon appears here and nowhere else on the row. It used to be
 * drawn twice — once on this tile and again at the row's trailing edge — which
 * read as two facts rather than one said twice.
 */

import { FileText, Image as ImageIcon, File } from 'lucide-react';
import { AppIcon } from '@rambleraptor/homestead-core/apps/lazy';
import { getDocType } from '../doc-types/registry';
import { categoryTone, documentCategory } from '../categories';
import { fileKind } from '../fileKind';
import type { Document } from '../types';

interface DocumentFileTileProps {
  document: Document;
  className?: string;
}

export function DocumentFileTile({ document, className = '' }: DocumentFileTileProps) {
  const status = document.parse_status ?? 'pending';
  const docType = document.metadata?.doc_type
    ? getDocType(document.metadata.doc_type)
    : undefined;

  const base = `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${className}`;

  // A recognised document leads with its type's icon on its category's tile —
  // the one place in the list where colour carries meaning rather than status,
  // and the row's only rendering of the type's icon.
  if (status === 'parsed' && docType) {
    const tone = categoryTone(documentCategory(document));
    return (
      <span
        className={`${base} ${tone.surface}`}
        title={docType.label}
        aria-label={docType.label}
        role="img"
        data-testid="document-type-icon"
      >
        <AppIcon icon={docType.icon} className="h-5 w-5" />
      </span>
    );
  }

  const kind = fileKind(document.mime_type);
  if (kind === 'pdf') {
    return (
      <span className={`${base} bg-red-50 text-red-500`} aria-hidden="true">
        <FileText className="h-5 w-5" />
      </span>
    );
  }
  if (kind === 'image') {
    return (
      <span className={`${base} bg-blue-50 text-blue-500`} aria-hidden="true">
        <ImageIcon className="h-5 w-5" />
      </span>
    );
  }
  return (
    <span className={`${base} bg-gray-100 text-text-muted`} aria-hidden="true">
      <File className="h-5 w-5" />
    </span>
  );
}
