import { useEffect } from 'react';

const POLL_INTERVAL_MS = 30_000;

/**
 * Reload the tab when the server starts serving a different SPA build — the
 * launcher rebuilds and restarts when homestead.config.ts changes, and open
 * tabs would otherwise keep running the old bundle.
 *
 * The current build id is baked in at build time (vite `define`, set by the
 * launcher's build pipeline). Dev and bare-source runs have none, which
 * disables the check.
 */
export function useBuildReload(): void {
  useEffect(() => {
    const current = process.env.HOMESTEAD_BUILD_ID;
    if (!current) return;
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch('/api/app-version');
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (!stopped && buildId && buildId !== current) {
          window.location.reload();
        }
      } catch {
        // Offline or mid-restart — the next tick retries.
      }
    };
    const timer = setInterval(() => void check(), POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
