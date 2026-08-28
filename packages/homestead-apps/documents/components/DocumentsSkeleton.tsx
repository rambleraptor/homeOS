/**
 * Placeholder rows for the documents index while the list is loading.
 *
 * The page used to show a lone centred spinner here. A spinner is the right
 * call when the shape of what's coming is unknown, and wrong here: what's
 * coming is a stack of rows of a fixed, known size, so the wait can be spent
 * looking at that shape instead of at an abstract token of delay — and the
 * content below doesn't jump when the rows land, because the space was already
 * the right height. `Skeleton`'s own header says as much.
 *
 * The blocks deliberately trace `DocumentListItem`: the same card shell, the
 * same 11×11 tile, a title line over a shorter meta line. A skeleton that
 * doesn't match what replaces it reads as a glitch, which is worse than the
 * spinner it replaced.
 */

import {
  Skeleton,
  SkeletonRegion,
} from '@rambleraptor/homestead-core/shared/components/Skeleton';

/** Title widths cycle rather than randomise, so the placeholder doesn't twitch
 *  between renders (the same reasoning as `Skeleton`'s own `ROW_WIDTHS`). */
const TITLE_WIDTHS = ['w-2/5', 'w-3/5', 'w-1/2', 'w-2/3'] as const;

export function DocumentsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <SkeletonRegion
      label="Loading documents"
      className="space-y-2"
      data-testid="documents-loading"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-surface-white p-3.5 shadow-sm"
        >
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className={`h-4 ${TITLE_WIDTHS[i % TITLE_WIDTHS.length]}`} />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}
