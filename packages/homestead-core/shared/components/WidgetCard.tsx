'use client';

import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@rambleraptor/homestead-core/shared/lib/utils';

/**
 * WidgetCard
 *
 * Base layout for dashboard widgets. Mirrors the Information Card design
 * (rounded-2xl, surface-white, bordered header) but with widget-specific
 * affordances:
 *   1. The title is a link to the owning module's home route (`href`).
 *   2. An optional config gear sits next to the collapse toggle and links
 *      to the widget's configuration page (`configHref`).
 *   3. A collapse toggle in the header hides the body so only the title row
 *      remains visible.
 *
 * @example
 *   <WidgetCard icon={ShoppingCart} title="Groceries" href="/groceries">
 *     ...content...
 *   </WidgetCard>
 */
export interface WidgetCardProps {
  /** Lucide icon rendered in the header chip. */
  icon?: LucideIcon;
  /** Widget title; rendered inside the link to the module home. */
  title: ReactNode;
  /** Module home route the title links to. */
  href: string;
  /**
   * Optional path to the widget's configuration page. When set, a grey
   * settings gear is rendered in the header next to the collapse toggle.
   */
  configHref?: string;
  /**
   * Accessible label for the config gear. Defaults to "Configure widget".
   * Override when the widget label alone isn't enough context for a
   * screen-reader user.
   */
  configLabel?: string;
  /** Body content. Hidden when the widget is collapsed. */
  children?: ReactNode;
  /** Start in the collapsed state. Defaults to false. */
  defaultCollapsed?: boolean;
  /** Additional classes merged into the outer card. */
  className?: string;
  /** Additional classes merged into the body wrapper. */
  bodyClassName?: string;
  /** Optional test id for the outer card. */
  'data-testid'?: string;
}

export function WidgetCard({
  icon: Icon,
  title,
  href,
  configHref,
  configLabel = 'Configure widget',
  children,
  defaultCollapsed = false,
  className,
  bodyClassName,
  'data-testid': testId,
}: WidgetCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const bodyId = useId();
  const ChevronIcon = collapsed ? ChevronDown : ChevronUp;

  return (
    <section
      className={cn(
        'bg-surface-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden',
        className,
      )}
      data-testid={testId}
    >
      <div
        className={cn(
          'flex items-center justify-between p-4',
          !collapsed && 'border-b border-gray-50',
        )}
      >
        <Link
          to={href}
          className="flex items-center gap-3 min-w-0 group rounded-lg -m-1 p-1 hover:bg-bg-pearl/60 transition-colors"
        >
          {Icon && (
            <div className="bg-gray-50 rounded-lg p-2" aria-hidden="true">
              <Icon className="w-5 h-5 text-brand-navy" />
            </div>
          )}
          <h2 className="font-display font-semibold text-lg text-brand-navy truncate group-hover:text-accent-terracotta transition-colors">
            {title}
          </h2>
        </Link>
        <div className="flex items-center gap-1 ml-2">
          {configHref && (
            <Link
              to={configHref}
              aria-label={configLabel}
              className="p-1.5 rounded-lg text-text-muted hover:text-brand-navy hover:bg-bg-pearl/60 transition-colors"
              data-testid="widget-config-link"
            >
              <Settings className="w-5 h-5" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            aria-label={collapsed ? 'Expand widget' : 'Collapse widget'}
            className="p-1.5 rounded-lg text-text-muted hover:text-brand-navy hover:bg-bg-pearl/60 transition-colors"
            data-testid="widget-collapse-toggle"
          >
            <ChevronIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      {children !== undefined && !collapsed && (
        <div id={bodyId} className={cn('p-4', bodyClassName)}>
          {children}
        </div>
      )}
    </section>
  );
}
