import { useState } from 'react';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { Input } from '@rambleraptor/homestead-core/shared/components/Input';
import { PersonSelector } from '@rambleraptor/homestead-core/shared/components/PersonSelector';
import { parseNthWeekdayRule } from '@rambleraptor/homestead-core/shared/utils/dateUtils';
import { usePeople } from '../../people/hooks/usePeople';
import { KNOWN_EVENT_TAGS } from '../types';
import type { Event, EventFormData, EventRecurrence } from '../types';

interface EventFormProps {
  initialData?: Event;
  onSubmit: (data: EventFormData) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const CUSTOM_TAG_SENTINEL = '__custom__';

const WEEK_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '1', label: '1st' },
  { value: '2', label: '2nd' },
  { value: '3', label: '3rd' },
  { value: '4', label: '4th' },
  { value: '-1', label: 'Last' },
];

const WEEKDAY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const MONTH_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((label, i) => ({ value: String(i + 1), label }));

function personIdFromRef(ref: string): string {
  return ref.startsWith('people/') ? ref.slice('people/'.length) : ref;
}

function knownTagOrCustom(tag: string | undefined):
  | { mode: 'known' | 'none'; value: string }
  | { mode: 'custom'; value: string } {
  if (!tag) return { mode: 'none', value: '' };
  if ((KNOWN_EVENT_TAGS as readonly string[]).includes(tag)) {
    return { mode: 'known', value: tag };
  }
  return { mode: 'custom', value: tag };
}

// Derive the "Nth weekday of month" from a month/day (and year, if known). The
// occurrence `n` comes from the day alone; the weekday needs a concrete year,
// so it's only derived when the user supplied one — otherwise they pick it.
// Maps a 5th occurrence to -1 ("Last") since the form has no 5th option and
// "last" is the more useful semantic.
function deriveNthWeekday(
  month: number,
  day: number,
  year?: number,
): { n: number; weekday: number | null } {
  const rawN = Math.ceil(day / 7);
  const n = rawN === 5 ? -1 : rawN;
  const weekday = year ? new Date(year, month - 1, day).getDay() : null;
  return { n, weekday };
}

export function EventForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}: EventFormProps) {
  const { data: people = [] } = usePeople();

  const initialPeopleIds = (initialData?.people ?? []).map(personIdFromRef);
  const initialTag = knownTagOrCustom(initialData?.tag);
  const initialRule =
    initialData?.recurrence === 'yearly-nth-weekday'
      ? parseNthWeekdayRule(initialData.recurrence_rule)
      : null;

  const [name, setName] = useState(initialData?.name ?? '');
  const [month, setMonth] = useState<string>(
    initialData?.month ? String(initialData.month) : '',
  );
  const [day, setDay] = useState<string>(
    initialData?.day ? String(initialData.day) : '',
  );
  const [year, setYear] = useState<string>(
    initialData?.year != null ? String(initialData.year) : '',
  );
  const [tagSelection, setTagSelection] = useState<string>(
    initialTag.mode === 'custom'
      ? CUSTOM_TAG_SENTINEL
      : initialTag.mode === 'known'
        ? initialTag.value
        : '',
  );
  const [customTag, setCustomTag] = useState<string>(
    initialTag.mode === 'custom' ? initialTag.value : '',
  );
  const [selectedPeople, setSelectedPeople] = useState<string[]>(
    initialPeopleIds,
  );
  const [recurrence, setRecurrence] = useState<EventRecurrence>(
    initialData?.recurrence === 'yearly-nth-weekday'
      ? 'yearly-nth-weekday'
      : 'yearly',
  );
  const [recurrenceWeek, setRecurrenceWeek] = useState<string>(
    initialRule ? String(initialRule.n) : '',
  );
  const [recurrenceWeekday, setRecurrenceWeekday] = useState<string>(
    initialRule ? String(initialRule.weekday) : '',
  );

  const handleTogglePerson = (personId: string) => {
    setSelectedPeople((prev) =>
      prev.includes(personId)
        ? prev.filter((p) => p !== personId)
        : [...prev, personId],
    );
  };

  const handleRecurrenceChange = (value: string) => {
    const next = value === 'yearly-nth-weekday' ? 'yearly-nth-weekday' : 'yearly';
    setRecurrence(next);
    if (
      next === 'yearly-nth-weekday' &&
      month &&
      day &&
      (!recurrenceWeek || !recurrenceWeekday)
    ) {
      const derived = deriveNthWeekday(
        Number(month),
        Number(day),
        year ? Number(year) : undefined,
      );
      if (!recurrenceWeek) setRecurrenceWeek(String(derived.n));
      if (!recurrenceWeekday && derived.weekday != null) {
        setRecurrenceWeekday(String(derived.weekday));
      }
    }
  };

  const resolvedTag =
    tagSelection === CUSTOM_TAG_SENTINEL
      ? customTag.trim() || undefined
      : tagSelection || undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedYear = year.trim();
    const base: EventFormData = {
      name: name.trim(),
      month: Number(month),
      day: Number(day),
      tag: resolvedTag,
      people: selectedPeople.map((id) => `people/${id}`),
    };
    if (trimmedYear !== '') {
      base.year = Number(trimmedYear);
    } else if (initialData) {
      // Editing and the year was cleared — send null so merge-patch drops it.
      base.year = null;
    }
    if (recurrence === 'yearly-nth-weekday' && recurrenceWeek && recurrenceWeekday) {
      base.recurrence = 'yearly-nth-weekday';
      base.recurrence_rule = `${recurrenceWeek}:${recurrenceWeekday}`;
    }
    onSubmit(base);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="event-name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Name <span className="text-red-500">*</span>
        </label>
        <Input
          id="event-name"
          data-testid="event-form-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div>
        <label
          htmlFor="event-form-month"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Date <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <select
            id="event-form-month"
            aria-label="Month"
            data-testid="event-form-month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            required
          >
            <option value="" disabled>
              Month…
            </option>
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <Input
            aria-label="Day"
            data-testid="event-form-day"
            type="number"
            min={1}
            max={31}
            placeholder="Day"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            required
          />
        </div>
        <Input
          aria-label="Year (optional)"
          data-testid="event-form-year"
          type="number"
          placeholder="Year (optional)"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="mt-3"
        />
        <p className="text-sm text-gray-500 mt-1">
          {recurrence === 'yearly-nth-weekday'
            ? 'Only the month is used — the day is ignored when the rule below is set.'
            : 'Events repeat yearly. The year is optional — add the birth or wedding year to show an age or anniversary count.'}
        </p>
      </div>

      <div>
        <label
          htmlFor="event-recurrence"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Repeats
        </label>
        <select
          id="event-recurrence"
          data-testid="event-form-recurrence"
          value={recurrence}
          onChange={(e) => handleRecurrenceChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="yearly">On this date every year</option>
          <option value="yearly-nth-weekday">
            The Nth weekday of this month every year
          </option>
        </select>
        {recurrence === 'yearly-nth-weekday' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <select
              aria-label="Week of month"
              data-testid="event-form-recurrence-week"
              value={recurrenceWeek}
              onChange={(e) => setRecurrenceWeek(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              required
            >
              <option value="" disabled>
                Week…
              </option>
              {WEEK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Weekday"
              data-testid="event-form-recurrence-weekday"
              value={recurrenceWeekday}
              onChange={(e) => setRecurrenceWeekday(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              required
            >
              <option value="" disabled>
                Weekday…
              </option>
              {WEEKDAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor="event-tag"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Tag
        </label>
        <select
          id="event-tag"
          data-testid="event-form-tag"
          value={tagSelection}
          onChange={(e) => setTagSelection(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="">No tag</option>
          {KNOWN_EVENT_TAGS.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
          <option value={CUSTOM_TAG_SENTINEL}>Custom…</option>
        </select>
        {tagSelection === CUSTOM_TAG_SENTINEL && (
          <Input
            id="event-tag-custom"
            data-testid="event-form-tag-custom"
            type="text"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            placeholder="e.g. graduation"
            className="mt-2"
          />
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          People
        </label>
        <PersonSelector
          people={people.map((p) => ({ id: p.id, name: p.name }))}
          variant="chips"
          isSelected={(id) => selectedPeople.includes(id)}
          onToggle={handleTogglePerson}
          containerTestId="event-form-people"
          itemTestId={(id) => `event-form-person-${id}`}
          emptyMessage="Add people in the People app first to tag them on events."
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={isSubmitting}
          data-testid="event-form-submit"
        >
          {isSubmitting ? 'Saving...' : initialData ? 'Update' : 'Create'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
