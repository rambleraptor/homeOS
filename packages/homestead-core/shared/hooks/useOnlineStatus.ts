import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';

/**
 * Reactive online/offline flag.
 *
 * Subscribes to React Query's `onlineManager` (which itself listens to the
 * browser `online`/`offline` events) so any UI badge stays in sync with the
 * same source of truth that pauses + resumes mutations.
 *
 * The initial value is read from the manager rather than from
 * `navigator.onLine`. Those two normally agree, but the subscription below
 * only delivers *changes* — so whenever they disagree at mount, nothing
 * corrects the seed until connectivity next flips. Seeding from the manager
 * keeps the claim this hook makes about its source of truth honest, and
 * matters wherever the manager is driven directly rather than by the browser
 * (tests, and React Query's own programmatic control).
 */
export function useOnlineStatus(): { isOnline: boolean; isOffline: boolean } {
  const [isOnline, setIsOnline] = useState<boolean>(() => onlineManager.isOnline());

  useEffect(() => {
    return onlineManager.subscribe((online) => {
      setIsOnline(online);
    });
  }, []);

  return { isOnline, isOffline: !isOnline };
}
