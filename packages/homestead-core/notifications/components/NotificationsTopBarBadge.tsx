/**
 * Top-bar decoration for the notifications app's bell button — the unread
 * count badge. Lazily loaded by the Header via `AppConfig.topBarBadge`.
 */

import { TopBarBadge } from '@rambleraptor/homestead-core/layout/TopBarBadge';
import { useNotificationStats } from '../hooks/useNotificationStats';

export function NotificationsTopBarBadge() {
  const { data: stats } = useNotificationStats();

  return <TopBarBadge count={stats?.unread ?? 0} />;
}
