/**
 * A searchable, category-grouped picker for document types.
 *
 * The catalogue is past forty types, of which twenty-five are tax forms whose
 * labels differ by three characters. A native `<select>` over that is a wall in
 * registry order: no way to type "1098" and see the three that match, no
 * grouping to tell a W-2 from a lab result, and on desktop a scroll list with
 * no headings. So this offers the same two affordances the supported-types page
 * already gives the catalogue — search, and the category a type belongs to —
 * wherever a type has to be chosen.
 *
 * Matching is token-wise over the label, description, and category with
 * punctuation stripped, so "1099 int", "1099-INT", and "interest" all reach
 * Form 1099-INT. Searching the description is what makes the picker usable
 * without knowing a form's official name.
 *
 * Two shapes, one component: `block` is the form-field version (full-width,
 * shows its current value), and the inline version is an action — "Classify
 * as…" — that holds no selection and fires on pick.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { AppIcon } from '@rambleraptor/homestead-core/apps/lazy';
import { useDismissOnOutside } from '@rambleraptor/homestead-core/shared/hooks/useDismissOnOutside';
import {
  categoryTone,
  groupDocTypesByCategory,
  OTHER_CATEGORY,
} from '../categories';
import { getDocType, getDocTypes } from '../doc-types/registry';
import { UNKNOWN_DOC_TYPE, type DocType } from '../doc-types/docType';

interface Option {
  id: string;
  label: string;
  description?: string;
  icon?: DocType['icon'];
}

interface OptionGroup {
  /** Category key, or '' for the pinned group above the catalogue. */
  category: string;
  label?: string;
  options: Option[];
}

interface DocTypeComboboxProps {
  /** The selected doc type id, or '' when the picker holds no selection. */
  value: string;
  onSelect: (docTypeId: string) => void;
  /** Trigger label while nothing is selected. */
  placeholder: string;
  disabled?: boolean;
  /** Full-width form field (vs. an inline toolbar action). */
  block?: boolean;
  /** Offer "No matching type" — clearing a document's type rather than setting one. */
  includeUnmatched?: boolean;
  /** Id for the trigger, so a `<label htmlFor>` points at it. */
  id?: string;
  /** Hover text on the trigger, for a picker whose *action* needs explaining. */
  title?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

const UNMATCHED_OPTION: Option = {
  id: UNKNOWN_DOC_TYPE,
  label: 'No matching type',
  description: 'Store the file without parsed fields.',
};

/** Roughly the panel's height: the search row plus a full list. */
const PANEL_HEIGHT = 340;

/** Lowercase and drop punctuation, so "1099-INT" and "1099 int" are one string. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function toOption(type: DocType): Option {
  return {
    id: type.id,
    label: type.label,
    description: type.description,
    icon: type.icon,
  };
}

/** The catalogue as groups, filtered to what matches every token of the query. */
function buildGroups(query: string, includeUnmatched: boolean): OptionGroup[] {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map(normalize)
    .filter(Boolean);

  const matches = (option: Option, categoryLabel?: string): boolean => {
    if (!tokens.length) return true;
    const haystack = normalize(
      [option.label, option.description, categoryLabel].filter(Boolean).join(' '),
    );
    return tokens.every((token) => haystack.includes(token));
  };

  const groups: OptionGroup[] = [];

  if (includeUnmatched && matches(UNMATCHED_OPTION)) {
    groups.push({ category: '', options: [UNMATCHED_OPTION] });
  }

  for (const group of groupDocTypesByCategory(getDocTypes())) {
    const options = group.types.map(toOption).filter((o) => matches(o, group.label));
    if (options.length) {
      groups.push({ category: group.category, label: group.label, options });
    }
  }

  return groups;
}

export function DocTypeCombobox({
  value,
  onSelect,
  placeholder,
  disabled = false,
  block = false,
  includeUnmatched = false,
  id,
  title,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: DocTypeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  // Whether the panel opens upward — decided from the trigger's position when
  // it opens. The picker sits at the bottom of a card on the detail page, where
  // a panel that always dropped down would open below the fold.
  const [dropUp, setDropUp] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const groups = useMemo(
    () => buildGroups(query, includeUnmatched),
    [query, includeUnmatched],
  );
  // Flattened, in render order — what the arrow keys walk.
  const flat = useMemo(() => groups.flatMap((g) => g.options), [groups]);

  const selected =
    value === UNKNOWN_DOC_TYPE ? UNMATCHED_OPTION : value ? getDocType(value) : undefined;

  const toggle = () => {
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      const below = rect ? window.innerHeight - rect.bottom : Infinity;
      const above = rect ? rect.top : 0;
      setDropUp(below < PANEL_HEIGHT && above > below);
    }
    setQuery('');
    setOpen((v) => !v);
  };

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (restoreFocus) triggerRef.current?.focus();
  };

  // Escape is handled on the search input rather than the document, so closing
  // the picker can't also close a dialog behind it.
  useDismissOnOutside(rootRef, open, () => close(false));

  // A fresh query renders a fresh list, so the highlight goes back to the top.
  useEffect(() => setActiveIndex(0), [query]);

  // Keep the highlighted option in view while arrowing through a long catalogue.
  // At the top of the list that means the top of the *list* — scrolling the
  // first option into view instead pushes its category heading out of sight.
  useEffect(() => {
    if (!open) return;
    if (activeIndex === 0) {
      if (listRef.current) listRef.current.scrollTop = 0;
      return;
    }
    const active = flat[activeIndex];
    if (!active) return;
    // Optional call: jsdom (and any non-browser renderer) has no scrollIntoView,
    // and keeping a highlight in view is never worth throwing over.
    const el = window.document.getElementById(`${listboxId}-${active.id}`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex, flat, listboxId]);

  const choose = (option: Option) => {
    onSelect(option.id);
    close(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
        break;
      case 'Enter': {
        e.preventDefault();
        const option = flat[activeIndex];
        if (option) choose(option);
        break;
      }
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  const triggerClass = `inline-flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-surface-white px-3 py-1.5 text-sm text-brand-slate transition-colors hover:bg-bg-pearl focus:border-accent-terracotta focus:outline-none focus:ring-2 focus:ring-accent-terracotta/30 disabled:opacity-50 ${
    block ? 'w-full px-3 py-2 text-left' : ''
  }`;

  return (
    <div ref={rootRef} className={`relative ${block ? 'block' : 'inline-block'}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={title}
        data-testid={testId}
        className={triggerClass}
      >
        <span className={selected ? 'truncate text-brand-navy' : 'truncate'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      </button>

      {open && (
        <div
          className={`absolute z-20 rounded-xl border border-gray-200 bg-surface-white shadow-md ${
            dropUp ? 'bottom-full mb-1' : 'mt-1'
          } ${block ? 'w-full' : 'right-0 w-[min(20rem,calc(100vw-3rem))]'}`}
          data-testid={testId ? `${testId}-panel` : undefined}
        >
          <div className="relative border-b border-gray-100 p-2">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search document types…"
              aria-label="Search document types"
              role="combobox"
              aria-controls={listboxId}
              aria-expanded
              aria-autocomplete="list"
              aria-activedescendant={
                flat[activeIndex] ? `${listboxId}-${flat[activeIndex].id}` : undefined
              }
              data-testid={testId ? `${testId}-search` : undefined}
              className="w-full rounded-lg border border-gray-200 bg-surface-white py-1.5 pl-8 pr-2 text-sm text-brand-slate placeholder:text-gray-400 focus:border-accent-terracotta focus:outline-none focus:ring-2 focus:ring-accent-terracotta/30"
            />
          </div>

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Document types"
            className="max-h-72 overflow-y-auto p-1"
          >
            {flat.length === 0 && (
              <li
                className="px-3 py-6 text-center text-sm text-text-muted"
                data-testid={testId ? `${testId}-empty` : undefined}
              >
                No document type matches “{query}”.
              </li>
            )}

            {groups.map((group) => {
              const tone = categoryTone(group.category || OTHER_CATEGORY);
              return (
                <li key={group.category || 'pinned'}>
                  {group.label && (
                    <p
                      className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-text-muted"
                      aria-hidden="true"
                    >
                      <span
                        className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded ${tone.surface}`}
                      >
                        <span className="h-1 w-1 rounded-full bg-current" />
                      </span>
                      {group.label}
                    </p>
                  )}
                  <ul role="none">
                    {group.options.map((option) => {
                      const index = flat.indexOf(option);
                      const isActive = index === activeIndex;
                      const isSelected = option.id === value;
                      return (
                        <li key={option.id} role="none">
                          <button
                            id={`${listboxId}-${option.id}`}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => choose(option)}
                            data-testid={`doc-type-option-${option.id}`}
                            className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                              isActive ? 'bg-bg-pearl' : ''
                            }`}
                          >
                            <span
                              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded ${tone.surface}`}
                              aria-hidden="true"
                            >
                              {option.icon && (
                                <AppIcon icon={option.icon} className="h-3.5 w-3.5" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-brand-navy">
                                {option.label}
                              </span>
                              {option.description && (
                                <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-text-muted">
                                  {option.description}
                                </span>
                              )}
                            </span>
                            {isSelected && (
                              <Check
                                className="mt-0.5 h-4 w-4 shrink-0 text-accent-terracotta"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
