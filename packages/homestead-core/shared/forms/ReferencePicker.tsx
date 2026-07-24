/**
 * Schema-driven picker for a resource-reference field. Given the referenced
 * resource's singular (e.g. `project`, `person`, `user`) it loads that
 * collection's records and lets the user pick one (`multiple={false}`) or many
 * (`multiple`). The stored value is the record **id** (or an array of ids) —
 * the documented reference convention.
 *
 * This is the UI counterpart to the already-machine-readable reference
 * annotation (`FieldDef.reference`): the chat tools, search, and the engine's
 * delete-time integrity checks read it server-side; this turns it into a
 * picker on the client. It generalizes the People-specific `PersonSelector`
 * (search box + toggle buttons) to any declared resource, resolving each
 * option's label with `pickRecordLabel`.
 *
 * When the target can't be listed by a plain collection call — an unknown
 * resource, or a parent-scoped one — the picker degrades to a plain id text
 * input rather than issuing a broken list request.
 */

import { useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { Input as ShadcnInput } from '@rambleraptor/homestead-core/shared/components/ui/input';
import { pickRecordLabel } from './pickRecordLabel';
import { pluralForSingular, isTopLevelReference } from './resourceLookup';
import { useResourceList } from './useResourceList';

export interface ReferencePickerProps {
  /** Kebab-case singular of the referenced resource, e.g. `project`. */
  resource: string;
  /**
   * Selected id(s). A `string | undefined` when `multiple` is false, a
   * `string[]` when `multiple` is true — kept as a union so the same prop
   * shape serves both.
   */
  value: string | string[] | undefined;
  onChange: (next: string | string[] | undefined) => void;
  /** Pick many records instead of one. */
  multiple?: boolean;
  disabled?: boolean;
  /** Whether an empty selection is invalid (drives the "clear" affordance). */
  required?: boolean;
  /** data-testid for the wrapper; the search box gets `${testId}-search`. */
  testId?: string;
}

/** Normalize the union value to the array the render path works with. */
function selectedIds(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function ReferencePicker({
  resource,
  value,
  onChange,
  multiple = false,
  disabled = false,
  required = false,
  testId,
}: ReferencePickerProps) {
  const [query, setQuery] = useState('');

  const plural = pluralForSingular(resource);
  const listable = isTopLevelReference(resource) && Boolean(plural);
  const { data: records = [], isLoading } = useResourceList(plural, {
    enabled: listable,
  });

  const options = useMemo(
    () =>
      records
        .map((r) => ({ id: r.id, label: pickRecordLabel(r) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [records],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selected = selectedIds(value);
  const isSelected = (id: string) => selected.includes(id);

  const toggle = (id: string) => {
    if (multiple) {
      onChange(isSelected(id) ? selected.filter((x) => x !== id) : [...selected, id]);
      return;
    }
    // Single-select: re-tapping the current value clears it (unless required).
    if (isSelected(id)) {
      if (!required) onChange(undefined);
      return;
    }
    onChange(id);
  };

  // Fallback: target we can't list — accept a raw id so the field still works.
  if (!listable) {
    const single = Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
    return (
      <ShadcnInput
        value={single}
        disabled={disabled}
        placeholder={`${resource} id`}
        onChange={(e) => {
          const v = e.target.value.trim();
          onChange(multiple ? (v ? [v] : []) : v || undefined);
        }}
        data-testid={testId ? `${testId}-idinput` : undefined}
      />
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-4"
        data-testid={testId ? `${testId}-loading` : undefined}
      >
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <p
        className="text-sm text-gray-600"
        data-testid={testId ? `${testId}-empty` : undefined}
      >
        No {plural} to choose from yet.
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${plural}…`}
          aria-label={`Filter ${plural}`}
          disabled={disabled}
          data-testid={testId ? `${testId}-search` : undefined}
          className="w-full h-9 pl-9 pr-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-terracotta"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          No {plural} match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filtered.map((opt) => {
            const active = isSelected(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggle(opt.id)}
                disabled={disabled}
                aria-pressed={active}
                data-testid={testId ? `${testId}-option-${opt.id}` : undefined}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors disabled:opacity-50 ${
                  active
                    ? 'bg-accent-terracotta border-accent-terracotta text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {opt.label}
                {active && <X className="w-3 h-3" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
