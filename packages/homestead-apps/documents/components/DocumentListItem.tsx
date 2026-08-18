/**
 * One row in the documents index: a file glyph, the name and type, a light
 * timestamp, and the parse status — linking to the document's detail page.
 * Parsed fields, full text, the file preview, and the rest of the actions all
 * live there.
 *
 * The row is also where a document's classification lands. When one finishes
 * reading while the list is open its glyph becomes the recognised type's icon,
 * and that swap is marked — see `useJustParsed`.
 *
 * Actions are optional. Given handlers, the row grows buttons for them and a
 * matching swipe gesture; given none — the read-only shelf the Home app builds
 * from these rows — it stays exactly the plain link it was.
 */

import { Link } from 'react-router-dom';
import { ChevronRight, FolderMinus, Trash2 } from 'lucide-react';
import { AppIcon } from '@rambleraptor/homestead-core/apps/lazy';
import { Badge } from '@rambleraptor/homestead-core/shared/components/Badge';
import { SwipeRow, type SwipeAction } from '@rambleraptor/homestead-core/shared/gestures';
import { formatDate } from '@rambleraptor/homestead-core/shared/utils/dateUtils';
import { getDocType } from '../doc-types/registry';
import { categoryTone, documentCategory } from '../categories';
import { useJustParsed } from '../hooks/useJustParsed';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentFileTile } from './DocumentFileTile';
import type { Document } from '../types';

const SHORT_DATE: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

interface DocumentListItemProps {
  document: Document;
  /** Delete the document. Confirmed by the caller — this only asks. */
  onDelete?: () => void;
  /**
   * Take the document out of the collection currently being viewed. Supplied
   * only when the index is scoped to one, since "remove from collection" has
   * no referent while looking at everything.
   */
  onRemoveFromCollection?: () => void;
  /** Name of that collection, for the action's accessible label. */
  collectionName?: string;
  disabled?: boolean;
}

export function DocumentListItem({
  document,
  onDelete,
  onRemoveFromCollection,
  collectionName,
  disabled = false,
}: DocumentListItemProps) {
  const status = document.parse_status ?? 'pending';
  const docType = document.metadata?.doc_type
    ? getDocType(document.metadata.doc_type)
    : undefined;

  // A parsed document that matched a type shows that type's icon in place of the
  // generic status badge; every other state keeps its status badge (Reading…,
  // No matching type, Failed) since there's no type icon to stand in for it.
  const showTypeIcon = status === 'parsed' && docType;
  const tone = categoryTone(documentCategory(document));
  const revealing = useJustParsed(status);

  const title = document.title || 'Untitled document';
  const removeLabel = collectionName
    ? `Remove from ${collectionName}`
    : 'Remove from collection';

  // Right is the recoverable action and left the destructive one, matching the
  // convention the todos rows set. Both are buttons first: a swipe is an
  // accelerator for the people who know it's there, never the only route.
  const swipeRight: SwipeAction | undefined = onRemoveFromCollection && {
    label: removeLabel,
    icon: FolderMinus,
    className: 'bg-brand-slate text-white',
    onAction: onRemoveFromCollection,
  };
  const swipeLeft: SwipeAction | undefined = onDelete && {
    label: 'Delete',
    icon: Trash2,
    className: 'bg-red-500 text-white',
    onAction: onDelete,
  };

  const actionButton =
    'rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40';

  // The chevron and the action buttons are both the row's right-hand
  // affordance, and showing both puts a "this opens" arrow immediately to the
  // left of two buttons it isn't pointing at. With actions present they *are*
  // the right edge; the row still opens from anywhere along the link.
  const hasActions = !!(onRemoveFromCollection || onDelete);

  const row = (
    <div
      className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-gray-100 bg-surface-white p-3.5 shadow-sm transition-colors hover:border-accent-terracotta/40 hover:bg-bg-pearl/60"
      data-testid="document-card"
      data-parse-status={status}
      data-revealing={revealing || undefined}
    >
      {/* One tinted band across the row on the poll where it became parsed. */}
      {revealing && (
        <span
          aria-hidden="true"
          className="animate-reveal-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-accent-terracotta/20 to-transparent"
        />
      )}

      {/* The link covers everything up to the actions, so the row still opens
          the document from anywhere a reader is likely to click. */}
      <Link
        to={`/documents/${document.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
        data-testid="document-open"
      >
        <DocumentFileTile
          document={document}
          className={revealing ? 'animate-reveal-pop' : ''}
        />

        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-sm font-semibold text-brand-navy"
            data-testid="document-title"
          >
            {title}
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
                <Badge
                  key={tag}
                  variant="neutral"
                  data-testid={`document-card-tag-${tag}`}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {showTypeIcon ? (
          <span
            className={`inline-flex shrink-0 items-center justify-center ${tone.icon}`}
            title={docType.label}
            aria-label={docType.label}
            data-testid="document-type-icon"
          >
            <AppIcon icon={docType.icon} className="h-5 w-5" />
          </span>
        ) : (
          <DocumentStatusBadge status={status} />
        )}
        {!hasActions && <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />}
      </Link>

      {hasActions && (
        <div className="ml-1 flex shrink-0 items-center gap-1 border-l border-gray-100 pl-2">
          {onRemoveFromCollection && (
            <button
              type="button"
              onClick={onRemoveFromCollection}
              disabled={disabled}
              aria-label={`${removeLabel}: ${title}`}
              title={removeLabel}
              data-testid="document-card-remove"
              className={`${actionButton} text-brand-slate hover:bg-brand-slate/10`}
            >
              <FolderMinus className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={disabled}
              aria-label={`Delete: ${title}`}
              title="Delete"
              data-testid="document-card-delete"
              className={`${actionButton} text-red-500 hover:bg-red-500/10`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (!swipeRight && !swipeLeft) return row;

  return (
    <SwipeRow
      swipeRight={swipeRight}
      swipeLeft={swipeLeft}
      disabled={disabled}
      className="rounded-xl bg-surface-white"
      data-testid="document-card-swipe"
    >
      {row}
    </SwipeRow>
  );
}
