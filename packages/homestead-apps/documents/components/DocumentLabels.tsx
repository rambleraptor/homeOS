/**
 * Everything a person has attached to a document by hand: its tags, the
 * collections it's filed in, and the people it's about.
 *
 * All three were editable and only tags were readable — to see which folders a
 * document sat in, or who it concerned, you had to open the edit form, which
 * is a strange place to have to go to answer "what is this?". They're grouped
 * here because they're one idea (what this document is connected to) even
 * though they're three fields.
 *
 * A person chip links to that person; a collection chip doesn't, because the
 * index's folder scope is local state rather than a route, and a chip that
 * looks clickable and isn't is worse than one that doesn't.
 */

import { Link } from 'react-router-dom';
import { Badge } from '@rambleraptor/homestead-core/shared/components/Badge';
import { useCollections } from '../hooks/useCollections';
import { usePeople } from '../../people/hooks/usePeople';
import type { Document } from '../types';

/** Chip shell shared by the collection and person chips. */
const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-surface-white px-3 py-1 text-xs text-brand-slate';

export function DocumentLabels({ document }: { document: Document }) {
  const { data: collections } = useCollections();
  const { data: people } = usePeople();

  const tags = document.tags ?? [];
  // Resolve ids against the loaded lists, dropping anything that no longer
  // exists: a deleted collection or person is cleaned off the document by the
  // engine's `set-null`, but a list still in flight would otherwise render a
  // chip with a raw id in it.
  const memberOf = (collections ?? []).filter((c) =>
    (document.collections ?? []).includes(c.id),
  );
  const about = (people ?? []).filter((p) => (document.people ?? []).includes(p.id));

  if (!tags.length && !memberOf.length && !about.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="document-labels">
      {memberOf.map((collection) => (
        <span
          key={collection.id}
          className={CHIP}
          data-testid={`document-collection-${collection.id}`}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: collection.color || '#4b5563' }}
            aria-hidden="true"
          />
          {collection.name}
        </span>
      ))}

      {about.map((person) => (
        <Link
          key={person.id}
          to={`/people/${person.id}`}
          className={`${CHIP} transition-colors hover:bg-bg-pearl`}
          data-testid={`document-person-${person.id}`}
        >
          {person.name}
        </Link>
      ))}

      {/* Tags last: they're the loosest of the three, and the two structured
          links deserve the eye first. */}
      {tags.length > 0 && (
        <span className="flex flex-wrap gap-2" data-testid="document-tags">
          {tags.map((tag) => (
            <Badge key={tag} variant="neutral" data-testid={`document-tag-${tag}`}>
              {tag}
            </Badge>
          ))}
        </span>
      )}
    </div>
  );
}
