/**
 * The document-category vocabulary, and the colour each category wears.
 *
 * A doc type declares a `category` describing what kind of document it is —
 * every tax form shares `tax`, every clinical document `medical`. That taxonomy
 * was already used to group documents into sections; this module gives it a
 * visual identity as well, so a filing cabinet of 40 documents reads as
 * something with shape rather than forty identical grey rows.
 *
 * Tones follow the `Badge` idiom (a Tailwind `-50`/`-700` pair) so a category
 * chip sits alongside the rest of the design system rather than shouting over
 * it. They deliberately avoid the hues the parse lifecycle already owns —
 * blue (reading), green (parsed), red (failed) — and the ones the file-kind
 * tile uses for an unrecognised upload (red for PDF, blue for image), so colour
 * never has to mean two things at once in the same row.
 *
 * Class strings are written out in full: Tailwind scans source text, so a tone
 * assembled from fragments (`bg-${hue}-50`) would compile to nothing.
 */

import { getDocType } from './doc-types/registry';
import type { DocType } from './doc-types/docType';
import type { Document } from './types';

/** Bucket for a document whose type declares no category (or has no type). */
export const OTHER_CATEGORY = 'other';

export interface CategoryTone {
  /** Soft surface + its foreground — the list tile and the category badge. */
  surface: string;
  /** Saturated foreground for an icon sitting on white or pearl. */
  icon: string;
  /** Border tint, for a card that wants the category to read at its edge. */
  border: string;
}

/**
 * Uncategorised documents keep today's neutral pearl tile. That's the point of
 * the catch-all: it stays quiet so the categorised ones carry the signal.
 */
const NEUTRAL_TONE: CategoryTone = {
  surface: 'bg-bg-pearl text-brand-navy',
  icon: 'text-text-muted',
  border: 'border-gray-200',
};

const TONES: Record<string, CategoryTone> = {
  tax: {
    surface: 'bg-amber-50 text-amber-700',
    icon: 'text-amber-600',
    border: 'border-amber-200',
  },
  medical: {
    surface: 'bg-teal-50 text-teal-700',
    icon: 'text-teal-600',
    border: 'border-teal-200',
  },
  insurance: {
    surface: 'bg-indigo-50 text-indigo-700',
    icon: 'text-indigo-600',
    border: 'border-indigo-200',
  },
  home: {
    surface: 'bg-violet-50 text-violet-700',
    icon: 'text-violet-600',
    border: 'border-violet-200',
  },
};

/** The tone for a category key. Unknown or absent keys get the neutral tone. */
export function categoryTone(category?: string): CategoryTone {
  return (category && TONES[category]) || NEUTRAL_TONE;
}

/** `property-tax` → `Property Tax`; the catch-all bucket → `Other`. */
export function categoryLabel(category: string): string {
  if (category === OTHER_CATEGORY) return 'Other';
  return category
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * The category a document belongs to, or {@link OTHER_CATEGORY}.
 *
 * Only a *parsed* document wears its category colour: while it's still reading,
 * or if it matched nothing, the metadata's `doc_type` may be a stale guess from
 * a previous pass, and colouring on that would flicker the row mid-classify.
 */
export function documentCategory(document: Document): string {
  if ((document.parse_status ?? 'pending') !== 'parsed') return OTHER_CATEGORY;
  const id = document.metadata?.doc_type;
  const type = id ? getDocType(id) : undefined;
  return type?.category ?? OTHER_CATEGORY;
}

/** A category and the doc types declared under it, in declaration order. */
export interface DocTypeGroup {
  category: string;
  label: string;
  types: DocType[];
}

/**
 * Group doc types by their declared category, keeping each category's types in
 * declaration order. Categorised groups sort alphabetically by label; the
 * uncategorised {@link OTHER_CATEGORY} bucket always sorts last.
 *
 * Shared by every surface that presents the catalogue — the supported-types
 * page and the type picker — so a document type appears under the same heading
 * in the same place wherever it is offered.
 */
export function groupDocTypesByCategory(types: DocType[]): DocTypeGroup[] {
  const byCategory = new Map<string, DocType[]>();
  for (const type of types) {
    const category = type.category ?? OTHER_CATEGORY;
    const group = byCategory.get(category);
    if (group) group.push(type);
    else byCategory.set(category, [type]);
  }
  return [...byCategory.entries()]
    .map(([category, groupTypes]) => ({
      category,
      label: categoryLabel(category),
      types: groupTypes,
    }))
    .sort((a, b) => {
      if (a.category === OTHER_CATEGORY) return 1;
      if (b.category === OTHER_CATEGORY) return -1;
      return a.label.localeCompare(b.label);
    });
}
