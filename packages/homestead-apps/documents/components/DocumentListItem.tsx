/**
 * One row in the documents index: just the name and type, linking to the
 * document's detail page. Everything else (parsed fields, full text, actions)
 * lives on that page.
 */

import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { AppIcon } from '@rambleraptor/homestead-core/apps/lazy';
import { Badge } from '@rambleraptor/homestead-core/shared/components/Badge';
import { getDocType } from '../doc-types/registry';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import type { Document } from '../types';

export function DocumentListItem({ document }: { document: Document }) {
  const status = document.parse_status ?? 'pending';
  const docType = document.metadata?.doc_type
    ? getDocType(document.metadata.doc_type)
    : undefined;

  // A parsed document that matched a type shows that type's icon in place of the
  // generic "Parsed" badge; every other state keeps its status badge (Reading…,
  // No matching type, Failed) since there's no type icon to stand in for it.
  const showTypeIcon = status === 'parsed' && docType;

  return (
    <Link
      to={`/documents/${document.id}`}
      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:bg-gray-50"
      data-testid="document-card"
      data-parse-status={status}
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-gray-900" data-testid="document-title">
          {document.title || 'Untitled document'}
        </h3>
        <p className="mt-1 text-xs text-gray-500" data-testid="document-type">
          {docType?.label ?? 'Unrecognised document'}
        </p>
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
          className="inline-flex shrink-0 items-center justify-center text-gray-500"
          title={docType.label}
          aria-label={docType.label}
          data-testid="document-type-icon"
        >
          <AppIcon icon={docType.icon} className="h-5 w-5" />
        </span>
      ) : (
        <DocumentStatusBadge status={status} />
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
    </Link>
  );
}
