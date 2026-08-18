import { Link } from 'react-router-dom';
import { Check, Moon, Pin, PinOff, Undo2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@rambleraptor/homestead-core/shared/lib/utils';
import { SwipeRow, type SwipeAction } from '@rambleraptor/homestead-core/shared/gestures';
import { TODO_KIND_STYLE } from '../kindStyles';
import type { Todo, TodoItem, TodoKind, TodoStatus } from '../types';

export type TodoRowVariant = 'active' | 'doLater' | 'completed';

interface TodoRowProps {
  todo: Todo | TodoItem;
  variant: TodoRowVariant;
  onSetStatus: (status: TodoStatus) => void;
  disabled?: boolean;
  /**
   * Render a coloured rail marking the todo's kind. Set on the main mixed
   * view, where personal and family todos are interleaved and the distinction
   * carries information; left undefined inside project views, where every row
   * is family and a marker would be noise on every line.
   */
  kindMarker?: TodoKind;
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
  /**
   * Which drag direction also performs this action, if any. Declared on the
   * same config the buttons are built from, so a swipe can never do something
   * the row doesn't already offer as a button — the two cannot drift apart.
   *
   * Cancel is deliberately button-only across every variant: it is the rarest
   * action and the least welcome to trigger by accident.
   */
  swipe?: 'left' | 'right';
}

/** Panel colours for the revealed swipe background, by direction of travel. */
const SWIPE_PANEL: Record<'left' | 'right', string> = {
  right: 'bg-green-500 text-white',
  left: 'bg-brand-navy text-white',
};

function swipeActionFor(
  actions: ActionConfig[],
  direction: 'left' | 'right',
  onSetStatus: (status: TodoStatus) => void,
): SwipeAction | undefined {
  const match = actions.find((a) => a.swipe === direction);
  if (!match) return undefined;
  return {
    label: match.label,
    icon: match.icon,
    className: SWIPE_PANEL[direction],
    onAction: () => onSetStatus(match.status),
  };
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
        swipe: 'left',
      },
      {
        testId: 'complete',
        label: 'Mark complete',
        icon: Check,
        color: 'text-green-500 hover:bg-green-500/10',
        status: 'completed',
        swipe: 'right',
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
        swipe: 'left',
      },
      {
        testId: 'complete',
        label: 'Mark complete',
        icon: Check,
        color: 'text-green-500 hover:bg-green-500/10',
        status: 'completed',
        swipe: 'right',
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
      // Right is "the positive action" everywhere else; on a finished todo the
      // only thing left to do is put it back, so right means restore here.
      swipe: 'right',
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
  kindMarker,
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

  // Read-only rows (synthetic todos derived from another app's state) have no
  // status actions at all, so there is nothing for a swipe to do.
  const canSwipe = !readOnly && !disabled;

  return (
    <SwipeRow
      disabled={!canSwipe}
      swipeRight={
        canSwipe ? swipeActionFor(actions, 'right', onSetStatus) : undefined
      }
      swipeLeft={
        canSwipe ? swipeActionFor(actions, 'left', onSetStatus) : undefined
      }
      className="bg-surface-white"
    >
      <div
        data-testid={`todo-row-${todo.id}`}
        className={cn(
          'group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-pearl',
        )}
      >
        {kindMarker && (
          // A sibling of the title rather than part of it: inside, a cancelled
          // row's line-through would strike the rail as well, and the marker
          // would shift left and right as titles change length instead of
          // forming a straight edge down the list.
          <span
            data-testid={`todo-row-${todo.id}-${kindMarker}`}
            title={TODO_KIND_STYLE[kindMarker].label}
            className={cn(
              'h-5 w-1.5 shrink-0 rounded-full',
              TODO_KIND_STYLE[kindMarker].rail,
            )}
          >
            <span className="sr-only">{TODO_KIND_STYLE[kindMarker].label}</span>
          </span>
        )}
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
    </SwipeRow>
  );
}
