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
 *
 * A document still being read carries a looping sheen across its tile. The row
 * already spins a loader inside its status badge, but that is a 12px detail at
 * the far end of the row: at the distance a list is actually scanned, a pending
 * document was indistinguishable from a finished one. The sheen is the "still
 * working" half of the pair whose other half — the sweep and pop when a
 * document resolves — was already here.
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

/** The looping sheen laid over a tile whose document is still being read. */
function Shimmer() {
  return (
    <span
      aria-hidden="true"
      className="animate-tile-shimmer pointer-events-none absolute inset-y-0 -left-full w-full bg-gradient-to-r from-transparent via-white/70 to-transparent"
    />
  );
}

export function DocumentFileTile({ document, className = '' }: DocumentFileTileProps) {
  const status = document.parse_status ?? 'pending';
  const docType = document.metadata?.doc_type
    ? getDocType(document.metadata.doc_type)
    : undefined;

  // `relative` + `overflow-hidden` on every tile so the sheen is clipped to the
  // tile's rounded box rather than running across the row.
  const base = `relative overflow-hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${className}`;

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

  // Only `pending` shimmers. `unmatched` and `failed` are finished outcomes —
  // a sheen on either would promise work that isn't coming.
  const reading = status === 'pending';
  const kind = fileKind(document.mime_type);

  if (kind === 'pdf') {
    return (
      <span
        className={`${base} bg-red-50 text-red-500`}
        aria-hidden="true"
        data-reading={reading || undefined}
      >
        <FileText className="h-5 w-5" />
        {reading && <Shimmer />}
      </span>
    );
  }
  if (kind === 'image') {
    return (
      <span
        className={`${base} bg-blue-50 text-blue-500`}
        aria-hidden="true"
        data-reading={reading || undefined}
      >
        <ImageIcon className="h-5 w-5" />
        {reading && <Shimmer />}
      </span>
    );
  }
  return (
    <span
      className={`${base} bg-gray-100 text-text-muted`}
      aria-hidden="true"
      data-reading={reading || undefined}
    >
      <File className="h-5 w-5" />
      {reading && <Shimmer />}
    </span>
  );
}
