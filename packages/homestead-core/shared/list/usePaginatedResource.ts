/**
 * Cursor pagination for an AEP collection, with no opinion about markup.
 *
 * `useResourceList` drains every page into one array — fine for a household's
 * 40 recipes, wrong for a receipts ledger. This hook keeps the pages: it holds
 * the cursor, exposes `loadMore`, and (in `mode: 'pages'`) lets a caller step
 * back through pages already in cache for free.
 *
 * Rendering is `<ResourceList>`'s job; this hook returns state only.
 */

import { useCallback, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { aepbase, type ParentPath, type ResourcePage } from '../../api/aepbase';
import { queryKeys } from '../../api/queryClient';

/** How loaded pages accumulate into `items`. */
export type PaginationMode =
  /** Append: each page joins the ones before it (load-more / infinite scroll). */
  | 'append'
  /** Pages: one page visible at a time, `next`/`prev` to step (tables). */
  | 'pages';

export interface PaginatedResourceOptions<T, R = T> {
  /** AEP list filter, applied **server-side**. */
  filter?: string;
  /** AEP `order_by` (e.g. `-create_time`). Sorting must be server-side here. */
  orderBy?: string;
  /** Parent chain for a nested collection. */
  parent?: ParentPath;
  /** Records per request. Engine default is 50, hard cap 1000. */
  pageSize?: number;
  /** Per-record transform, applied as pages arrive. */
  map?: (record: T) => R;
  mode?: PaginationMode;
  /** Hold the query (e.g. while a parent id is still unknown). */
  enabled?: boolean;
}

/** What a list needs to render itself. Also `<ResourceList>`'s `source` prop. */
export interface PaginatedResource<R> {
  /** Records to render: every loaded page, or the current one in `pages` mode. */
  items: R[];
  /**
   * Which slot should render. `empty` is only reported once the first page has
   * actually come back — a list is never "empty" while it is still loading.
   */
  state: 'loading' | 'error' | 'empty' | 'ready';
  error: Error | null;
  /** The server handed back another cursor, or a later page is already cached. */
  hasMore: boolean;
  /** A follow-up page is in flight (the first page reports `state: 'loading'`). */
  isFetchingMore: boolean;
  /** Append mode: pull the next page. No-op when there isn't one. */
  loadMore: () => void;
  /** Pages mode: step forward (fetching only if that page isn't cached yet). */
  next: () => void;
  /** Pages mode: step back — always cached, so instant and request-free. */
  prev: () => void;
  /** Zero-based index of the visible page in `pages` mode. */
  pageIndex: number;
  /** Pages loaded so far. Not a total page count — the total is unknowable. */
  loadedPages: number;
  retry: () => void;
}

export function usePaginatedResource<T, R = T>(
  appId: string,
  singular: string,
  plural: string,
  options: PaginatedResourceOptions<T, R> = {},
): PaginatedResource<R> {
  const {
    filter,
    orderBy,
    parent,
    pageSize = 50,
    map,
    mode = 'append',
    enabled = true,
  } = options;

  const [pageIndex, setPageIndex] = useState(0);

  const query = useInfiniteQuery<ResourcePage<T>, Error>({
    // Filter/order/parent are part of the key: change any of them and the
    // cursor sequence is a different one, so it gets its own cache slot.
    queryKey: queryKeys.app(appId).resource(singular).paged({ filter, orderBy, parent, pageSize }),
    queryFn: ({ pageParam }) =>
      aepbase.page<T>(plural, {
        filter,
        orderBy,
        parent,
        maxPageSize: pageSize,
        pageToken: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextPageToken,
    enabled,
  });

  const pages = query.data?.pages ?? [];

  const items = useMemo(() => {
    const raw = mode === 'pages' ? (pages[pageIndex]?.results ?? []) : pages.flatMap((p) => p.results);
    return map ? raw.map(map) : (raw as unknown as R[]);
    // `query.data` is the real dependency; `pages` is derived from it.
  }, [query.data, pageIndex, mode, map]);

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  const next = useCallback(() => {
    if (pageIndex + 1 < pages.length) {
      setPageIndex(pageIndex + 1);
      return;
    }
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage().then(() => setPageIndex((i) => i + 1));
    }
  }, [pageIndex, pages.length, query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  const prev = useCallback(() => setPageIndex((i) => Math.max(0, i - 1)), []);

  const state: PaginatedResource<R>['state'] = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : items.length === 0 && !query.hasNextPage
        ? 'empty'
        : 'ready';

  return {
    items,
    state,
    error: query.error ?? null,
    // In pages mode a later page may already be cached, so "more" is true even
    // when the server has no further cursor. In append mode every loaded page
    // is already on screen, so only the cursor counts.
    hasMore: query.hasNextPage || (mode === 'pages' && pageIndex + 1 < pages.length),
    isFetchingMore: query.isFetchingNextPage,
    loadMore,
    next,
    prev,
    pageIndex,
    loadedPages: pages.length,
    retry: () => void query.refetch(),
  };
}
