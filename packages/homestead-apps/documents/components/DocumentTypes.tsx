/**
 * Supported document types: the full catalogue of doc types the app can
 * recognise, so a user knows what will be parsed automatically before they
 * upload.
 *
 * Read-only and entirely declaration-driven — it renders whatever
 * `getDocTypes()` returns (label, description, category, and the fields each
 * type extracts), so a new doc-type module appears here with no change to this
 * component.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AppIcon } from '@rambleraptor/homestead-core/apps/lazy';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { getDocTypes } from '../doc-types/registry';
import { categoryLabel, categoryTone, OTHER_CATEGORY } from '../categories';
import type { DocType } from '../doc-types/docType';

interface DocTypeGroup {
  category: string;
  label: string;
  types: DocType[];
}

/**
 * Group the doc types by category, keeping each category's types in
 * declaration order. Categorised groups sort alphabetically; the uncategorised
 * "Other" bucket sorts last.
 */
function groupByCategory(types: DocType[]): DocTypeGroup[] {
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

function DocTypeCard({ type }: { type: DocType }) {
  const fields = Object.values(type.fields);
  const tone = categoryTone(type.category);
  return (
    <div
      className={`rounded-lg border bg-white p-4 ${tone.border}`}
      data-testid="doc-type-card"
      data-doc-type={type.id}
      data-category={type.category ?? OTHER_CATEGORY}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.surface}`}
          aria-hidden="true"
        >
          <AppIcon icon={type.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-gray-900" data-testid="doc-type-label">
            {type.label}
          </h3>
          <p className="mt-1 text-xs text-gray-500">{type.description}</p>
          {fields.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-700">Extracted fields</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid="doc-type-fields">
                {fields.map((field) => (
                  <span
                    key={field.label}
                    className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                  >
                    {field.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentTypes() {
  const groups = useMemo(() => groupByCategory(getDocTypes()), []);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/documents"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          data-testid="doc-types-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to documents
        </Link>
      </div>

      <PageHeader
        title="Supported document types"
        subtitle="Upload one of these and we'll recognise it and pull out its details automatically. Anything else is still stored — just without parsed fields."
      />

      {groups.map((group) => {
        const tone = categoryTone(group.category);
        return (
          <section key={group.category} className="space-y-3" data-testid="doc-type-group">
            <h2
              className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500"
              data-testid="doc-type-group-label"
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-md ${tone.surface}`}
                aria-hidden="true"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              </span>
              {group.label}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.types.map((type) => (
                <DocTypeCard key={type.id} type={type} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
