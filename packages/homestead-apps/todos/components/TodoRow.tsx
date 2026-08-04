import { Link } from 'react-router-dom';
import { Check, Moon, Pin, PinOff, Undo2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@rambleraptor/homestead-core/shared/lib/utils';
import type { Todo, TodoItem, TodoStatus } from '../types';

export type TodoRowVariant = 'active' | 'doLater' | 'completed';

interface TodoRowProps {
  todo: Todo | TodoItem;
  variant: TodoRowVariant;
  onSetStatus: (status: TodoStatus) => void;
  disabled?: boolean;
  /**
   * When true, render the 👪 family marker before the title. Set on the main
   * mixed view for family todos so they stand out from personal ones; left off
   * inside project views (where every row is already family).
   */
  familyMarker?: boolean;
  /** When true, show a subtle "you" hint — a family todo the viewer created. */
  createdByYou?: boolean;
  /**
   * Read-only rows render no action buttons. Used for synthetic todos that
   * are derived from other apps' state (e.g. "Buy N groceries") and
   * complete implicitly when the source state is empty.
   */
  readOnly?: boolean;
  /**
   * When set, render a pin/unpin button that toggles whether the todo also
   * appears on the main project view. Only meaningful for todos that belong
   * to a real project (not main).
   */
  onTogglePin?: (inMain: boolean) => void;
  /** Origin label shown on main view rows pinned from a project. */
  pinnedFromLabel?: string;
  /**
   * When set, the title is rendered as a link to this href. Used by synthetic
   * todos to deep-link into the source app (e.g. "Buy N groceries" links
   * to the groceries page).
   */
  href?: string;
}

interface ActionConfig {
  testId: string;
  label: string;
  icon: LucideIcon;
  color: string;
  status: TodoStatus;
}

function actionsForVariant(variant: TodoRowVariant): ActionConfig[] {
  if (variant === 'active') {
    return [
      {
        testId: 'cancel',
        label: 'Cancel',
        icon: X,
        color: 'text-red-500 hover:bg-red-500/10',
        status: 'cancelled',
      },
      {
        testId: 'dolater',
        label: 'Move to do later',
        icon: Moon,
        color: 'text-brand-navy hover:bg-brand-navy/10',
        status: 'do_later',
      },
      {
        testId: 'complete',
        label: 'Mark complete',
        icon: Check,
        color: 'text-green-500 hover:bg-green-500/10',
        status: 'completed',
      },
    ];
  }

  if (variant === 'doLater') {
    return [
      {
        testId: 'cancel',
        label: 'Cancel',
        icon: X,
        color: 'text-red-500 hover:bg-red-500/10',
        status: 'cancelled',
      },
      {
        testId: 'restore',
        label: 'Move back to active',
        icon: Undo2,
        color: 'text-brand-navy hover:bg-brand-navy/10',
        status: 'pending',
      },
      {
        testId: 'complete',
        label: 'Mark complete',
        icon: Check,
        color: 'text-green-500 hover:bg-green-500/10',
        status: 'completed',
      },
    ];
  }

  return [
    {
      testId: 'undo',
      label: 'Undo',
      icon: Undo2,
      color: 'text-brand-navy hover:bg-brand-navy/10',
      status: 'pending',
    },
  ];
}

export function TodoRow({
  todo,
  variant,
  onSetStatus,
  disabled,
  readOnly,
  onTogglePin,
  pinnedFromLabel,
  href,
  familyMarker,
  createdByYou,
}: TodoRowProps) {
  const actions = readOnly ? [] : actionsForVariant(variant);
  const isCancelled = todo.status === 'cancelled';
  const isPinned = todo.in_main === true;
  const PinIcon = isPinned ? PinOff : Pin;
  const pinLabel = isPinned ? 'Unpin from main' : 'Pin to main';

  const titleClassName = cn(
    'flex-1 font-body text-base text-text-main',
    variant === 'completed' && 'text-text-muted',
    isCancelled && 'line-through',
    href && 'hover:text-accent-terracotta transition-colors',
  );
  const titleContent = (
    <>
      {familyMarker && (
        <span
          data-testid={`todo-row-${todo.id}-family`}
          aria-label="Family todo"
          title="Family todo — shared with everyone"
          className="mr-1.5 select-none"
        >
          👪
        </span>
      )}
      {todo.title}
      {createdByYou && (
        <span
          data-testid={`todo-row-${todo.id}-you`}
          className="ml-2 text-xs font-body italic text-text-muted"
        >
          you
        </span>
      )}
      {pinnedFromLabel && (
        <span
          data-testid={`todo-row-${todo.id}-origin`}
          className="ml-2 text-xs font-body italic text-text-muted"
        >
          from {pinnedFromLabel}
        </span>
      )}
    </>
  );

  return (
    <div
      data-testid={`todo-row-${todo.id}`}
      className={cn(
        'group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-pearl',
      )}
    >
      {href ? (
        <Link
          to={href}
          data-testid={`todo-row-${todo.id}-link`}
          className={titleClassName}
        >
          {titleContent}
        </Link>
      ) : (
        <span className={titleClassName}>{titleContent}</span>
      )}
      <div className="flex items-center gap-1">
        {onTogglePin && !readOnly && (
          <button
            type="button"
            onClick={() => onTogglePin(!isPinned)}
            disabled={disabled}
            aria-label={`${pinLabel}: ${todo.title}`}
            data-testid={`todo-row-${todo.id}-pin`}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              'text-brand-navy hover:bg-brand-navy/10',
              isPinned && 'bg-brand-navy/15',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <PinIcon className="w-4 h-4" />
          </button>
        )}
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.testId}
              type="button"
              onClick={() => onSetStatus(action.status)}
              disabled={disabled}
              aria-label={`${action.label}: ${todo.title}`}
              data-testid={`todo-row-${todo.id}-${action.testId}`}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                action.color,
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
