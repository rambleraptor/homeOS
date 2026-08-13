/**
 * The square glyph at the start of a document row. It gives the list a visual
 * anchor without fetching every file: a matched document shows its doc-type
 * icon, otherwise a MIME-based file glyph (PDF / image / generic). Cheap and
 * consistent — the real page preview lives on the detail page.
 */

import { FileText, Image as ImageIcon, File } from 'lucide-react';
import { AppIcon } from '@rambleraptor/homestead-core/apps/lazy';
import { getDocType } from '../doc-types/registry';
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

  // A recognised document leads with its type's icon on a soft neutral tile.
  if (status === 'parsed' && docType) {
    return (
      <span className={`${base} bg-bg-pearl text-brand-navy`} aria-hidden="true">
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
