/**
 * Client-side bulk-import types.
 *
 * The parse contract (formats, parsers, savers, the wire shapes) lives in
 * `core/resources/bulk-import/types.ts` — it's shared with the server. What's
 * left here is what the standardized page needs and the server doesn't: how an
 * app renders a preview row.
 */

import type { ParsedItem } from '@rambleraptor/homestead-core/resources/bulk-import/types';

export type { ParsedItem };

/** Props every preview component receives. */
export interface ItemPreviewProps<T = unknown> {
  item: ParsedItem<T>;
  isSelected: boolean;
  onToggle: () => void;
}

/** An app's custom preview row. Optional — {@link DefaultItemPreview} covers the rest. */
export type ItemPreviewComponent<T = unknown> = React.ComponentType<ItemPreviewProps<T>>;

/** Everything the standardized import page needs from an app. */
export interface BulkImportPageConfig<T = unknown> {
  /**
   * Kebab-case plural of the resource to import into, e.g. `gift-cards`.
   * Everything else — formats, validation, writes — is resolved from the
   * server's declaration for this resource.
   */
  plural: string;
  /** Singular display name, e.g. `Gift Card`. */
  appName: string;
  /** Plural display name, e.g. `gift cards`. */
  appNamePlural: string;
  /** Where the back button and post-import redirect go, e.g. `/gift-cards`. */
  backRoute: string;
  /**
   * Query key invalidated once the import lands, so the app's list reflects it
   * without a reload — e.g. `queryKeys.app('gift-cards').all()`. Explicit
   * because keys are app-scoped (`['app', appId, …]`), not derivable from the
   * resource plural.
   */
  queryKey: readonly unknown[];
  /** Custom preview row. Falls back to a generic key/value renderer. */
  preview?: ItemPreviewComponent<T>;
}
