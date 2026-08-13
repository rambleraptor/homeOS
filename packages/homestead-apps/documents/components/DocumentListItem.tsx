/**
 * One row in the documents index: a file glyph, the name and type, a light
 * timestamp, and the parse status — linking to the document's detail page.
 * Parsed fields, full text, the file preview, and actions all live there.
 */

import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { AppIcon } from '@rambleraptor/homestead-core/apps/lazy';
import { Badge } from '@rambleraptor/homestead-core/shared/components/Badge';
import { formatDate } from '@rambleraptor/homestead-core/shared/utils/dateUtils';
import { getDocType } from '../doc-types/registry';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentFileTile } from './DocumentFileTile';
import type { Document } from '../types';

const SHORT_DATE: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

export function DocumentListItem({ document }: { document: Document }) {
  const status = document.parse_status ?? 'pending';
  const docType = document.metadata?.doc_type
    ? getDocType(document.metadata.doc_type)
    : undefined;

  // A parsed document that matched a type shows that type's icon in place of the
  // generic status badge; every other state keeps its status badge (Reading…,
  // No matching type, Failed) since there's no type icon to stand in for it.
  const showTypeIcon = status === 'parsed' && docType;

  return (
    <Link
      to={`/documents/${document.id}`}
      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-surface-white p-3.5 shadow-sm transition-colors hover:border-accent-terracotta/40 hover:bg-bg-pearl/60"
      data-testid="document-card"
      data-parse-status={status}
    >
      <DocumentFileTile document={document} />

      <div className="min-w-0 flex-1">
        <h3
          className="truncate text-sm font-semibold text-brand-navy"
          data-testid="document-title"
        >
          {document.title || 'Untitled document'}
        </h3>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
          <span data-testid="document-type" className="truncate">
            {docType?.label ?? 'Unrecognised document'}
          </span>
          {document.create_time && (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">
                {formatDate(document.create_time, SHORT_DATE)}
              </span>
            </>
          )}
        </div>
        {document.tags && document.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" data-testid="document-card-tags">
            {document.tags.map((tag) => (
              <Badge key={tag} variant="neutral" data-testid={`document-card-tag-${tag}`}>
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {showTypeIcon ? (
        <span
          className="inline-flex shrink-0 items-center justify-center text-text-muted"
          title={docType.label}
          aria-label={docType.label}
          data-testid="document-type-icon"
        >
          <AppIcon icon={docType.icon} className="h-5 w-5" />
        </span>
      ) : (
        <DocumentStatusBadge status={status} />
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
    </Link>
  );
}
