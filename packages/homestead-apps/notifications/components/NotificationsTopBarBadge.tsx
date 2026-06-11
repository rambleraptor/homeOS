/**
 * Unread-count badge for the notifications app's top-bar button.
 * Lazily loaded by the Header via `AppConfig.topBarBadge`.
 */

import { TopBarBadge } from '@rambleraptor/homestead-core/layout/TopBarBadge';
import { useNotificationStats } from '../hooks/useNotificationStats';

export function NotificationsTopBarBadge() {
  const { data: stats } = useNotificationStats();
  return <TopBarBadge count={stats?.unread ?? 0} />;
}
