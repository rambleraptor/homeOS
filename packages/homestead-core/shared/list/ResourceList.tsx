/**
 * A list container that owns pagination and nothing else.
 *
 * It renders no wrapper element, no classes, no chrome: the app supplies every
 * pixel through slots, and the container decides *which* slot is on screen and
 * when the next page is fetched. So a grid of recipe cards, a table of users,
 * and a sectioned todo list can all share the paging logic while looking
 * nothing alike.
 *
 *   <ResourceList source={receipts} empty={<EmptyReceipts />}>
 *     {(items) => <ReceiptTable rows={items} />}
 *   </ResourceList>
 */

import { useEffect, useRef, type ReactNode } from 'react';
import type { PaginatedResource } from './usePaginatedResource';

export interface ResourceListProps<R> {
  /** State from `usePaginatedResource` (usually via an app's own hook). */
  source: PaginatedResource<R>;
  /** The list itself. Called only when there is at least one record. */
  children: (items: R[]) => ReactNode;
  /** First page in flight. Omit to render nothing while loading. */
  loading?: ReactNode;
  /** First page failed. `retry` refetches from page one. */
  error?: (error: Error, retry: () => void) => ReactNode;
  /** Loaded, no records. Omit and an empty list renders `children([])`. */
  empty?: ReactNode;
  /**
   * The "there is more" affordance — a Load more button, a spinner, a
   * page stepper. Rendered after `children`, only while `hasMore`.
   */
  more?: (control: MoreControl) => ReactNode;
  /**
   * Fetch the next page when the sentinel scrolls into view (infinite scroll).
   * The sentinel is a bare unstyled `<div>`; `more` still renders if provided,
   * which is how you get a spinner under an auto-loading list.
   */
  auto?: boolean;
  /** Root margin for the auto sentinel — start fetching before it's visible. */
  autoRootMargin?: string;
}

export interface MoreControl {
  loadMore: () => void;
  next: () => void;
  prev: () => void;
  isFetchingMore: boolean;
  hasMore: boolean;
  pageIndex: number;
  loadedPages: number;
}

export function ResourceList<R>({
  source,
  children,
  loading,
  error,
  empty,
  more,
  auto = false,
  autoRootMargin = '200px',
}: ResourceListProps<R>) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!auto) return;
    const el = sentinelRef.current;
    if (!el || !source.hasMore) return;
    // Guarded on `hasMore` so the observer is torn down at the end of the
    // list rather than firing against a no-op `loadMore` forever.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) source.loadMore();
      },
      { rootMargin: autoRootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [auto, autoRootMargin, source.hasMore, source.isFetchingMore, source.loadMore]);

  if (source.state === 'loading') return <>{loading ?? null}</>;
  if (source.state === 'error') {
    return <>{error ? error(source.error!, source.retry) : null}</>;
  }
  if (source.state === 'empty' && empty !== undefined) return <>{empty}</>;

  return (
    <>
      {children(source.items)}
      {source.hasMore && more?.({
        loadMore: source.loadMore,
        next: source.next,
        prev: source.prev,
        isFetchingMore: source.isFetchingMore,
        hasMore: source.hasMore,
        pageIndex: source.pageIndex,
        loadedPages: source.loadedPages,
      })}
      {auto && source.hasMore && <div ref={sentinelRef} aria-hidden="true" />}
    </>
  );
}
