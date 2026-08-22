/**
 * Describe what a document turned into.
 *
 * A doc type may declare a `post_classify` hook that creates a record in
 * another app from the document — a medical receipt becomes an HSA receipt, a
 * recipe photo becomes a recipe. The hook records what it made on the document
 * as `linked_resource`, a `"{plural}/{id}"` path. Until now nothing read it
 * back, so the app did the most impressive thing it does and never mentioned
 * it.
 *
 * The targets are enumerable because the hooks that produce them are declared
 * by this app's own doc types (see `doc-types/post-classify/`). A new hook adds
 * an entry here; an unmapped path still renders, just without a link, so a
 * missed entry degrades to "we know it made something" rather than to silence.
 */

/** A `linked_resource` path resolved for display. */
export interface LinkedResource {
  /** The collection's plural, e.g. `hsa-receipts`. */
  plural: string;
  /** The created record's id. */
  id: string;
  /** Bare noun for a sentence: "Saved as an HSA receipt" → `HSA receipt`. */
  label: string;
  /**
   * The indefinite article the label takes. Declared rather than derived: the
   * rule is about how a word is *said*, not how it's spelled, so an initialism
   * like "HSA" ("aitch-ess-ay") takes "an" despite starting with a consonant.
   */
  article: 'a' | 'an';
  /** Where to send the reader, or undefined when the target has no route. */
  href?: string;
}

interface LinkedResourceTarget {
  label: string;
  /** Override when the label's spelling and its pronunciation disagree. */
  article?: 'a' | 'an';
  /**
   * The route for one record. Omitted when the target app has no per-record
   * page — the HSA app is a single index, so a receipt has nowhere of its own
   * to link to and the app's own page is the honest destination.
   */
  href: (id: string) => string;
}

const TARGETS: Record<string, LinkedResourceTarget> = {
  'hsa-receipts': { label: 'HSA receipt', article: 'an', href: () => '/receipts' },
  'charitable-receipts': {
    label: 'charitable receipt',
    href: () => '/receipts?tab=charitable',
  },
  recipes: { label: 'recipe', href: (id) => `/recipes/${id}` },
};

/** The spelling-based guess, used when a target doesn't override it. */
function guessArticle(label: string): 'a' | 'an' {
  return /^[aeiou]/i.test(label) ? 'an' : 'a';
}

/** `hsa-receipts` → `HSA receipts`; a readable fallback for an unmapped target. */
function labelFromPlural(plural: string): string {
  return plural.replace(/-/g, ' ');
}

/**
 * Parse a stored `linked_resource` path. Returns null for an absent or
 * malformed value rather than throwing — it's display-only, and a document with
 * a bad pointer should still render.
 */
export function describeLinkedResource(path?: string): LinkedResource | null {
  if (!path) return null;
  const separator = path.lastIndexOf('/');
  if (separator <= 0 || separator === path.length - 1) return null;

  const plural = path.slice(0, separator);
  const id = path.slice(separator + 1);
  const target = TARGETS[plural];

  const label = target?.label ?? labelFromPlural(plural);
  return {
    plural,
    id,
    label,
    article: target?.article ?? guessArticle(label),
    href: target?.href(id),
  };
}
