/**
 * Query-key constant for a user's `account-tag` collection. Lives here
 * so both `useUsers` (which bulk-fetches every user's tags) and
 * `useUpdateUser` (which invalidates the targeted user's slot after a
 * reconcile) point at the same cache key without circular imports.
 */
export const accountTagsQueryKey = (userId: string) =>
  ['account-tags', 'user', userId] as const;
