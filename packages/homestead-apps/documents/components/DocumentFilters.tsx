/**
 * The documents index filter bar: a free-text search plus type and person
 * dropdowns. Presentational — the parent owns the filter state and computes the
 * facet options from the loaded list, so this only renders and reports changes.
 */

import { Search, X } from 'lucide-react';
import type { DocumentFilters as Filters, DocTypeFacet, PersonFacet } from '../filtering';
import { hasActiveFilters } from '../filtering';

interface DocumentFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  /** Doc types present in the list — the type dropdown's options. */
  docTypes: DocTypeFacet[];
  /** People named across the list — the person dropdown's options. */
  people: PersonFacet[];
}

const SELECT_CLASS =
  'rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export function DocumentFilters({
  filters,
  onChange,
  docTypes,
  people,
}: DocumentFiltersProps) {
  const active = hasActiveFilters(filters);

  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
      data-testid="document-filters"
    >
      <div className="relative flex-1 sm:min-w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search documents…"
          aria-label="Search documents"
          data-testid="document-search"
          className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {docTypes.length > 0 && (
        <select
          value={filters.docType}
          onChange={(e) => onChange({ ...filters, docType: e.target.value })}
          aria-label="Filter by document type"
          data-testid="document-type-filter"
          className={SELECT_CLASS}
        >
          <option value="">All types</option>
          {docTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      )}

      {people.length > 0 && (
        <select
          value={filters.person}
          onChange={(e) => onChange({ ...filters, person: e.target.value })}
          aria-label="Filter by person"
          data-testid="document-person-filter"
          className={SELECT_CLASS}
        >
          <option value="">Anyone</option>
          {people.map((person) => (
            <option key={person.value} value={person.value}>
              {person.label}
            </option>
          ))}
        </select>
      )}

      {active && (
        <button
          type="button"
          onClick={() => onChange({ search: '', docType: '', person: '' })}
          data-testid="document-filters-clear"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
          Clear
        </button>
      )}
    </div>
  );
}
