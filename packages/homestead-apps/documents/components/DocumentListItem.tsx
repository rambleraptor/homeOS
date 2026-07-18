/**
 * One row in the documents index: just the name and type, linking to the
 * document's detail page. Everything else (parsed fields, full text, actions)
 * lives on that page.
 */

import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getDocType } from '../doc-types/registry';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import type { Document } from '../types';

export function DocumentListItem({ document }: { document: Document }) {
  const status = document.parse_status ?? 'pending';
  const docType = document.metadata?.doc_type
    ? getDocType(document.metadata.doc_type)
    : undefined;

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
      </div>
      <DocumentStatusBadge status={status} />
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
    </Link>
  );
}
