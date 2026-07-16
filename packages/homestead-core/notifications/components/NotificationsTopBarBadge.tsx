/**
 * Top-bar decoration for the notifications app's bell button.
 *
 * While any AEP-151 operation is running, the bell is covered by a spinner so
 * the icon visually reads as "working". Otherwise it shows the usual unread
 * count badge. Lazily loaded by the Header via `AppConfig.topBarBadge`.
 */

import { TopBarBadge } from '@rambleraptor/homestead-core/layout/TopBarBadge';
import { Spinner } from '@rambleraptor/homestead-core/shared/components/Spinner';
import { useNotificationStats } from '../hooks/useNotificationStats';
import { useHasOngoingOperations } from '../hooks/useOperations';

export function NotificationsTopBarBadge() {
  const { data: stats } = useNotificationStats();
  const hasOngoingOperations = useHasOngoingOperations();

  if (hasOngoingOperations) {
    // Overlay the bell (the base icon is fixed in Header) with a spinner.
    return (
      <span
        className="absolute inset-0 flex items-center justify-center rounded-lg bg-surface-white"
        aria-label="Operations in progress"
        data-testid="operations-spinner"
      >
        <Spinner size="sm" />
      </span>
    );
  }

  return <TopBarBadge count={stats?.unread ?? 0} />;
}
