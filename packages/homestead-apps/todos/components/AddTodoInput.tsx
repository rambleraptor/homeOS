import { useState, type FormEvent } from 'react';
import { User, Users } from 'lucide-react';
import { cn } from '@rambleraptor/homestead-core/shared/lib/utils';
import { TODO_KIND_STYLE } from '../kindStyles';
import type { TodoKind } from '../types';

interface AddTodoInputProps {
  onSubmit: (title: string, kind: TodoKind) => Promise<void> | void;
  disabled?: boolean;
}

/**
 * Inline "Add new item" row. Two icon buttons — private (the default,
 * submitted on Enter) and shared — so a new todo lands in the right
 * collection. Both are offered in every list: a project list is a shared
 * *place*, which says nothing about who should see an item filed in it, and
 * the private option used to vanish the moment you left Main. Clears the field
 * after a successful submit.
 *
 * Each button wears the colour its todos will wear in the list, taken from the
 * shared `TODO_KIND_STYLE` map so a button and the rows it produces cannot
 * end up different colours. Pressing the terracotta button puts a
 * terracotta-railed row in the list; that is the whole cue.
 */
export function AddTodoInput({ onSubmit, disabled }: AddTodoInputProps) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (kind: TodoKind) => {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed, kind);
      setValue('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit('personal');
  };

  const isDisabled = disabled || submitting;
  const isEmpty = value.trim() === '';

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'flex items-center gap-2 bg-surface-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3',
        'focus-within:border-accent-terracotta focus-within:ring-2 focus-within:ring-accent-terracotta/20',
        'transition-colors',
      )}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add new item"
        aria-label="Add new todo"
        disabled={isDisabled}
        data-testid="todos-add-input"
        className="flex-1 bg-transparent outline-none font-body text-base text-text-main placeholder:text-text-muted"
      />
      <div className="flex items-center gap-1.5">
        <button
          type="submit"
          disabled={isDisabled || isEmpty}
          aria-label="Add private todo"
          title="Private — only you can see it"
          data-testid="todos-add-submit-personal"
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full',
            'text-white shadow-sm transition-colors',
            TODO_KIND_STYLE.personal.button,
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <User className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => void submit('family')}
          disabled={isDisabled || isEmpty}
          aria-label="Add shared todo"
          title="Shared — everyone in the household can see it"
          data-testid="todos-add-submit-family"
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full',
            'text-white shadow-sm transition-colors',
            TODO_KIND_STYLE.family.button,
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <Users className="w-5 h-5" />
        </button>
      </div>
    </form>
  );
}
