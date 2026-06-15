import { useEffect } from 'react';

const POLL_INTERVAL_MS = 30_000;

/**
 * Reload the tab when the server starts serving a different SPA build — under
 * `homestead start`, Vite's watch-mode build rebuilds the dist when
 * homestead.config.ts or an app changes, and open tabs would otherwise keep
 * running the old bundle.
 *
 * The build id comes from /api/app-version (the server hashes the served
 * index.html). The first successful poll establishes this tab's baseline; a
 * later change reloads. An empty id (dev, bare-source runs) disables the check.
 */
export function useBuildReload(): void {
  useEffect(() => {
    let stopped = false;
    let baseline: string | null = null;
    const check = async () => {
      try {
        const res = await fetch('/api/app-version');
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (stopped || !buildId) return;
        if (baseline === null) {
          baseline = buildId;
        } else if (buildId !== baseline) {
          window.location.reload();
        }
      } catch {
        // Offline or mid-restart — the next tick retries.
      }
    };
    void check();
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
