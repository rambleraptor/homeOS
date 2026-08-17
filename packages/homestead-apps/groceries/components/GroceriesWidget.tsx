/**
 * Dashboard widget showing the count of grocery items still to be
 * purchased. Registered via `groceriesApp.widgets`.
 */

import { ShoppingCart } from 'lucide-react';
import {
  Skeleton,
  SkeletonRegion,
} from '@rambleraptor/homestead-core/shared/components/Skeleton';
import { WidgetCard } from '@rambleraptor/homestead-core/shared/components/WidgetCard';
import { useGroceries } from '../hooks/useGroceries';

export function GroceriesWidget() {
  const { data: items, isLoading } = useGroceries();
  const remaining = items?.filter((item) => !item.checked).length ?? 0;

  return (
    <WidgetCard
      icon={ShoppingCart}
      title="Groceries"
      href="/groceries"
      data-testid="groceries-widget"
    >
      {isLoading ? (
        // Matches the count-and-label line below, not a generic block: this
        // widget's whole body is one short sentence.
        <SkeletonRegion
          label="Loading groceries"
          className="flex items-baseline gap-2 py-2"
          data-testid="groceries-widget-loading"
        >
          <Skeleton className="h-8 w-10" />
          <Skeleton className="h-5 w-28" />
        </SkeletonRegion>
      ) : remaining > 0 ? (
        <div className="flex items-baseline gap-2 py-2">
          <span className="font-display text-3xl text-text-main">{remaining}</span>
          <span className="font-body text-text-muted">
            {remaining === 1 ? 'item left to buy' : 'items left to buy'}
          </span>
        </div>
      ) : (
        <p className="font-body text-text-muted py-2">
          Nothing left to buy — your list is clear.
        </p>
      )}
    </WidgetCard>
  );
}
