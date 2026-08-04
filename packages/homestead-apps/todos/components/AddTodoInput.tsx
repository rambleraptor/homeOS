import { useState, type FormEvent } from 'react';
import { Plus, User, Users } from 'lucide-react';
import { cn } from '@rambleraptor/homestead-core/shared/lib/utils';
import type { TodoKind } from '../types';

interface AddTodoInputProps {
  onSubmit: (title: string, kind: TodoKind) => Promise<void> | void;
  disabled?: boolean;
  /**
   * When true (the main view), offer both a personal and a family button, with
   * personal as the Enter-key default. When false (a project view), personal
   * todos don't apply, so a single family "add" button is shown.
   */
  allowPersonal?: boolean;
}

/**
 * Inline "Add new item" row. On the main view it exposes two icon buttons —
 * personal (the default, submitted on Enter) and family — so a new todo lands
 * in the right collection. In a project view only the family button is shown.
 * Clears the field after a successful submit.
 */
export function AddTodoInput({
  onSubmit,
  disabled,
  allowPersonal,
}: AddTodoInputProps) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const defaultKind: TodoKind = allowPersonal ? 'personal' : 'family';

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
    void submit(defaultKind);
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
      {allowPersonal ? (
        <div className="flex items-center gap-1.5">
          <button
            type="submit"
            disabled={isDisabled || isEmpty}
            aria-label="Add personal todo"
            title="Add to your personal list"
            data-testid="todos-add-submit-personal"
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full',
              'bg-accent-terracotta text-white shadow-sm',
              'hover:bg-accent-terracotta-hover transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <User className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => void submit('family')}
            disabled={isDisabled || isEmpty}
            aria-label="Add family todo"
            title="Add to the shared family list"
            data-testid="todos-add-submit-family"
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full',
              'bg-brand-navy text-white shadow-sm',
              'hover:bg-brand-navy/90 transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <Users className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={isDisabled || isEmpty}
          aria-label="Add todo"
          data-testid="todos-add-submit"
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full',
            'bg-accent-terracotta text-white shadow-sm',
            'hover:bg-accent-terracotta-hover transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <Plus className="w-5 h-5" />
        </button>
      )}
    </form>
  );
}
