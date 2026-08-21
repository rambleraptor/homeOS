/**
 * Receipt Empty State
 *
 * First-run onboarding for a tab with nothing in it. Explains the two ways to
 * capture a receipt — by hand here, or automatically by uploading it in the
 * Documents app — and offers the primary call to action. Carries the "No
 * receipts found" copy so each tab has a single, friendly empty state.
 */

import type { LucideIcon } from 'lucide-react';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';

export interface EmptyStateRoute {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  body: string;
}

interface ReceiptEmptyStateProps {
  icon: LucideIcon;
  title: string;
  blurb: string;
  /** The two ways in. Rendered side by side above the call to action. */
  routes: [EmptyStateRoute, EmptyStateRoute];
  cta: { icon: LucideIcon; label: string; onClick: () => void };
}

export function ReceiptEmptyState({
  icon: Icon,
  title,
  blurb,
  routes,
  cta,
}: ReceiptEmptyStateProps) {
  const CtaIcon = cta.icon;
  return (
    <section className="rounded-2xl border border-gray-100 bg-surface-white p-8 text-center shadow-sm sm:p-10">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-terracotta/10">
        <Icon className="h-7 w-7 text-accent-terracotta" aria-hidden="true" />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold text-brand-navy">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">{blurb}</p>

      <div className="mx-auto mt-6 grid max-w-lg gap-3 text-left sm:grid-cols-2">
        {routes.map((route) => {
          const RouteIcon = route.icon;
          return (
            <div
              key={route.title}
              className="rounded-xl border border-gray-100 bg-bg-pearl p-4"
            >
              <RouteIcon className={`h-5 w-5 ${route.iconClassName}`} aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-brand-navy">{route.title}</p>
              <p className="mt-1 text-xs text-text-muted">{route.body}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <Button onClick={cta.onClick}>
          <CtaIcon className="h-4 w-4" />
          {cta.label}
        </Button>
      </div>
    </section>
  );
}
