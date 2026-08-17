/**
 * Skeleton
 *
 * Placeholder shapes for content that hasn't arrived yet.
 *
 * A spinner says "something is happening." A skeleton says "a list of six
 * things is arriving, and it will sit exactly here." That difference is why
 * skeletons feel faster despite taking the same wall-clock time: the wait is
 * spent looking at the shape of the answer instead of at an abstract token of
 * delay. It also removes the layout jump when data lands, because the space
 * was already reserved at roughly the right size.
 *
 * Use a skeleton when the shape of what's loading is known and stable — a
 * list, a card grid, a widget body, a whole page. Keep a spinner for work with
 * no predictable shape: a button mid-submit, a file upload, a chat response.
 * Guessing wrong is worse than a spinner, since a skeleton that doesn't match
 * what appears reads as a glitch.
 *
 * Accessibility: the blocks are decorative and hidden from assistive tech; the
 * composites wrap them in a single polite live region so a screen reader hears
 * "Loading todos" once, rather than crawling a dozen empty divs. That's also
 * why the composites render bare shapes internally — nesting one inside
 * another would announce the same load twice.
 *
 * Under `prefers-reduced-motion` the global guard in `globals.css` settles the
 * pulse to a static block, which is a perfectly good loading state — no
 * per-component handling needed.
 *
 * @example
 *   if (isLoading) return <SkeletonList rows={4} label="Loading todos" />;
 */

import type { ReactNode } from 'react';
import { cn } from '@rambleraptor/homestead-core/shared/lib/utils';

interface SkeletonProps {
  /** Additional classes — set width/height/shape here. */
  className?: string;
  'data-testid'?: string;
}

/**
 * One placeholder block. The atom every composite below is built from, and
 * what you reach for directly when a layout needs a bespoke shape.
 *
 * Carries no size of its own: a skeleton is only useful when it matches the
 * thing it stands in for, so the caller always sets that.
 */
export function Skeleton({ className, 'data-testid': testId }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-200/80', className)}
      aria-hidden="true"
      data-testid={testId}
    />
  );
}

/**
 * Wraps placeholder content in a single polite live region.
 *
 * Exported for loading states that arrange `<Skeleton>` blocks themselves and
 * still want the one-announcement behaviour.
 */
export function SkeletonRegion({
  label,
  className,
  children,
  'data-testid': testId,
}: {
  /** Announced to screen readers, e.g. "Loading recipes". */
  label: string;
  className?: string;
  children: ReactNode;
  'data-testid'?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={className}
      data-testid={testId}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/**
 * Row widths cycle through a fixed sequence rather than varying randomly: a
 * random width would change on every re-render and make the placeholder
 * twitch, and it would break snapshot tests for no benefit.
 */
const ROW_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6'] as const;

/** Bare list rows, no live region. Shared by `SkeletonList` and `SkeletonPage`. */
function ListRows({ rows, showLeading }: { rows: number; showLeading: boolean }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          {showLeading && <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />}
          <Skeleton className={cn('h-4', ROW_WIDTHS[i % ROW_WIDTHS.length])} />
        </div>
      ))}
    </>
  );
}

/** Bare card grid, no live region. Shared by `SkeletonCards` and `SkeletonPage`. */
function CardGrid({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-200 bg-surface-white p-4 shadow-sm"
        >
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      ))}
    </>
  );
}

const GRID_CLASSES = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

/**
 * Lines of placeholder text.
 *
 * The last line is short. Real paragraphs don't end flush with the margin, and
 * a stack of equal-width bars reads as a table or a chart rather than prose.
 */
export function SkeletonText({
  lines = 3,
  label = 'Loading',
  className,
  'data-testid': testId,
}: {
  lines?: number;
  label?: string;
  className?: string;
  'data-testid'?: string;
}) {
  return (
    <SkeletonRegion
      label={label}
      className={cn('space-y-2', className)}
      data-testid={testId}
    >
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </SkeletonRegion>
  );
}

/**
 * Rows of placeholder list items — the shape most dashboard widgets and app
 * list views are waiting on.
 */
export function SkeletonList({
  rows = 3,
  label = 'Loading',
  /** Leading square per row, matching a list that has icons or thumbnails. */
  showLeading = false,
  className,
  'data-testid': testId,
}: {
  rows?: number;
  label?: string;
  showLeading?: boolean;
  className?: string;
  'data-testid': string;
}) {
  return (
    <SkeletonRegion
      label={label}
      className={cn('divide-y divide-gray-50', className)}
      data-testid={testId}
    >
      <ListRows rows={rows} showLeading={showLeading} />
    </SkeletonRegion>
  );
}

/**
 * A grid of placeholder cards, for views that render their records as cards
 * rather than rows.
 *
 * The column counts mirror the grids in the app homes this stands in for, so
 * the placeholder and the real content wrap at the same breakpoints.
 */
export function SkeletonCards({
  count = 6,
  label = 'Loading',
  className,
  'data-testid': testId,
}: {
  count?: number;
  label?: string;
  className?: string;
  'data-testid': string;
}) {
  return (
    <SkeletonRegion
      label={label}
      className={cn(GRID_CLASSES, className)}
      data-testid={testId}
    >
      <CardGrid count={count} />
    </SkeletonRegion>
  );
}

/**
 * A whole app screen: a `<PageHeader>`-shaped block above a body of cards or
 * rows.
 *
 * App homes early-return their loading state, which replaces the entire page —
 * so with a bare spinner the title, subtitle, and action buttons all pop into
 * existence when the data lands, and the content the user was aiming at shifts
 * down the moment they reach for it. Standing in for the header too keeps the
 * page frame still across the transition.
 *
 * The header placeholder's dimensions track `PageHeader`'s typography (a
 * `text-3xl` title over a `text-base` subtitle, actions to the right).
 *
 * @example
 *   if (isLoading) {
 *     return <SkeletonPage body="cards" label="Loading recipes"
 *                          data-testid="recipes-loading" />;
 *   }
 */
export function SkeletonPage({
  /** What the page's content area looks like once it arrives. */
  body = 'cards',
  /** Rows or cards to draw. Ignored when `body` is 'none'. */
  bodyCount = 6,
  label = 'Loading',
  /** Set false for pages whose header renders separately from the body. */
  showHeader = true,
  className,
  /**
   * Merged into the body container — override the grid's column counts here
   * when the page's real grid doesn't use the default breakpoints.
   */
  bodyClassName,
  'data-testid': testId,
}: {
  body?: 'cards' | 'list' | 'none';
  bodyCount?: number;
  label?: string;
  showHeader?: boolean;
  className?: string;
  bodyClassName?: string;
  'data-testid': string;
}) {
  return (
    <SkeletonRegion
      label={label}
      className={cn('space-y-6', className)}
      data-testid={testId}
    >
      {showHeader && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Skeleton className="h-9 w-52" />
            <Skeleton className="mt-2 h-5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      )}

      {body === 'cards' && (
        <div className={cn(GRID_CLASSES, bodyClassName)}>
          <CardGrid count={bodyCount} />
        </div>
      )}
      {body === 'list' && (
        <div className={cn('divide-y divide-gray-50', bodyClassName)}>
          <ListRows rows={bodyCount} showLeading />
        </div>
      )}
    </SkeletonRegion>
  );
}
