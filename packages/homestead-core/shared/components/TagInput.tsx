import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Label } from '@rambleraptor/homestead-core/shared/components/ui/label';
import { Input as ShadcnInput } from '@rambleraptor/homestead-core/shared/components/ui/input';
import { Badge } from '@rambleraptor/homestead-core/shared/components/Badge';

interface TagInputProps {
  id?: string;
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Test id prefix. Chips render with `${testId}-chip-${tag}` and the
   * underlying text input with `${testId}-input`.
   */
  testId?: string;
}

/**
 * Free-form chip-style tag input. Users type a tag and commit with
 * Enter or comma. Backspace on an empty input removes the last chip.
 * Tags are case-preserved but trimmed and deduped on commit.
 */
export function TagInput({
  id,
  label,
  value,
  onChange,
  placeholder = 'Add tag…',
  disabled = false,
  testId,
}: TagInputProps) {
  const [draft, setDraft] = useState('');

  const commit = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (value.includes(tag)) {
      setDraft('');
      return;
    }
    onChange([...value, tag]);
    setDraft('');
  };

  const remove = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      e.preventDefault();
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="w-full">
      {label && (
        <Label htmlFor={id} className="mb-2">
          {label}
        </Label>
      )}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="neutral"
            className="gap-1 pr-1.5"
            data-testid={testId ? `${testId}-chip-${tag}` : undefined}
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              disabled={disabled}
              aria-label={`Remove tag ${tag}`}
              className="rounded-full p-0.5 hover:bg-gray-200 disabled:opacity-50"
              data-testid={testId ? `${testId}-remove-${tag}` : undefined}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <ShadcnInput
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(draft)}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="h-7 flex-1 min-w-[8rem] border-0 px-1 shadow-none focus-visible:ring-0"
          data-testid={testId ? `${testId}-input` : undefined}
        />
      </div>
    </div>
  );
}
