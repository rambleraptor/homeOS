/**
 * One row in the documents index: a file glyph, the name, a light timestamp,
 * and — when there is something to say — the recognised type and the parse
 * status. Parsed fields, full text, the file preview, and the rest of the
 * actions all live on the document's detail page, which the row links to.
 *
 * The row is also where a document's classification lands. When one finishes
 * reading while the list is open its glyph becomes the recognised type's icon,
 * and that swap is marked — see `useJustParsed`. A document that matched no
 * type simply says nothing: no type line, no badge.
 *
 * Actions are optional. Given handlers, the row can be swiped to delete or to
 * take it out of the folder in view; given none — the read-only shelf the Home
 * app builds from these rows — it stays exactly the plain link it was.
 *
 * The swipe has no button beside it, against `SwipeRow`'s usual buttons-first
 * rule. Both actions remain reachable without the gesture, on the document's
 * own page: Delete under Manage, and collection membership in the edit form.
 * So the row is a shortcut to them rather than the only way to reach them.
 */

import { Link } from 'react-router-dom';
import { ChevronRight, FolderMinus, Trash2 } from 'lucide-react';
import { Badge } from '@rambleraptor/homestead-core/shared/components/Badge';
import { SwipeRow, type SwipeAction } from '@rambleraptor/homestead-core/shared/gestures';
import { formatDate } from '@rambleraptor/homestead-core/shared/utils/dateUtils';
import { getDocType } from '../doc-types/registry';
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

  // The row only ever states a classification it has. A matched document is
  // identified by its tile, which carries that type's icon in its category's
  // colour; a document the app couldn't place says nothing at all, since "no
  // matching type" is the ordinary outcome for most household paper and a badge
  // for it reads like an error to fix. That leaves the badge to the two states
  // that really are in flight: Reading… and Failed.
  const showStatus = status === 'pending' || status === 'failed';
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
            {docType && (
              <span data-testid="document-type" className="truncate">
                {docType.label}
              </span>
            )}
            {document.create_time && (
              <>
                {docType && <span aria-hidden="true">·</span>}
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

        {showStatus && <DocumentStatusBadge status={status} />}
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
      </Link>
    </div>
  );

  if (!swipeRight && !swipeLeft) return row;

  return (
    // SwipeRow's own container is square-cornered — right for the flush,
    // divider-separated lists it was built for, wrong here where every row is a
    // rounded card. Without this the action panel revealed behind the row shows
    // square corners past the card's curve. Clipping on the outside rounds the
    // panel and the row together.
    <div className="overflow-hidden rounded-xl">
      <SwipeRow
        swipeRight={swipeRight}
        swipeLeft={swipeLeft}
        disabled={disabled}
        className="rounded-xl bg-surface-white"
        data-testid="document-card-swipe"
      >
        {row}
      </SwipeRow>
    </div>
  );
}
