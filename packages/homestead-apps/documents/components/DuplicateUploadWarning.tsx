/**
 * Soft, dismissible warning shown after a hand-upload that matches an existing
 * document by content hash. Purely presentational — the parent supplies the
 * detected duplicates and the actions — so it renders the same whether the
 * match was found on upload or on a later poll once the hash lands.
 */

import { Link } from 'react-router-dom';
import { CopyCheck, X } from 'lucide-react';
import type { DuplicateUpload } from '../duplicates';

interface DuplicateUploadWarningProps {
  duplicates: DuplicateUpload[];
  /** Delete the just-uploaded copy (leaves the original in place). */
  onDelete: (id: string) => void;
  /** Dismiss the warning for one upload without deleting anything. */
  onDismiss: (id: string) => void;
  deletingId?: string;
}

export function DuplicateUploadWarning({
  duplicates,
  onDelete,
  onDismiss,
  deletingId,
}: DuplicateUploadWarningProps) {
  if (duplicates.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="document-duplicate-warning">
      {duplicates.map(({ upload, original }) => (
        <div
          key={upload.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800"
        >
          <CopyCheck className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            “{upload.title || 'This upload'}” looks like a copy of an existing document.
          </span>
          <Link
            to={`/documents/${original.id}`}
            className="font-medium underline hover:text-amber-900"
            data-testid="document-duplicate-view"
          >
            View existing
          </Link>
          <button
            type="button"
            onClick={() => onDelete(upload.id)}
            disabled={deletingId === upload.id}
            className="font-medium underline hover:text-amber-900 disabled:opacity-50"
            data-testid="document-duplicate-delete"
          >
            {deletingId === upload.id ? 'Deleting…' : 'Delete this upload'}
          </button>
          <button
            type="button"
            onClick={() => onDismiss(upload.id)}
            aria-label="Dismiss duplicate warning"
            className="rounded p-0.5 hover:bg-amber-100"
            data-testid="document-duplicate-dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
