/**
 * One document in the list: its type, parse state, and parsed fields.
 */

import { useState } from 'react';
import { FileText, Loader2, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react';
import { getDocType } from '../doc-types/registry';
import { DocumentMetadata } from './DocumentMetadata';
import type { Document } from '../types';
import type { ParseStatus } from '../resources';

interface DocumentCardProps {
  document: Document;
  onReclassify: (id: string) => void;
  isReclassifying: boolean;
}

/**
 * `unmatched` is deliberately styled as neutral information, not a warning:
 * most household documents aren't a known form, and that's a normal outcome
 * rather than something the user needs to fix.
 */
const STATUS_META: Record<
  ParseStatus,
  { label: string; className: string; icon: typeof FileText }
> = {
  pending: {
    label: 'Reading…',
    className: 'bg-blue-50 text-blue-700',
    icon: Loader2,
  },
  parsed: { label: 'Parsed', className: 'bg-green-50 text-green-700', icon: FileText },
  unmatched: {
    label: 'No matching type',
    className: 'bg-gray-100 text-gray-600',
    icon: HelpCircle,
  },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700', icon: AlertCircle },
};

export function DocumentCard({
  document,
  onReclassify,
  isReclassifying,
}: DocumentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const status = document.parse_status ?? 'pending';
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const docType =
    document.metadata?.doc_type ? getDocType(document.metadata.doc_type) : undefined;

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-4"
      data-testid="document-card"
      data-parse-status={status}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className="truncate text-sm font-medium text-gray-900"
            data-testid="document-title"
          >
            {document.title || 'Untitled document'}
          </h3>
          <p className="mt-1 text-xs text-gray-500" data-testid="document-type">
            {docType?.label ?? 'Unrecognised document'}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs ${meta.className}`}
          data-testid="document-status"
        >
          <Icon className={`h-3 w-3 ${status === 'pending' ? 'animate-spin' : ''}`} />
          {meta.label}
        </span>
      </div>

      {status === 'parsed' && (
        <div className="mt-4">
          <DocumentMetadata metadata={document.metadata} />
        </div>
      )}

      {document.full_text && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-blue-600 hover:underline"
            data-testid="document-toggle-text"
          >
            {expanded ? 'Hide text' : 'Show text'}
          </button>
          {expanded && (
            <pre
              className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700"
              data-testid="document-full-text"
            >
              {document.full_text}
            </pre>
          )}
        </div>
      )}

      {status !== 'pending' && (
        <button
          type="button"
          onClick={() => onReclassify(document.id)}
          disabled={isReclassifying}
          className="mt-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
          data-testid="document-reclassify"
        >
          <RefreshCw className="h-3 w-3" />
          Read again
        </button>
      )}
    </div>
  );
}
