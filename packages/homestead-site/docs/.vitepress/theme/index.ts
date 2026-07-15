import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import Landing from './Landing.vue';
import './custom.css';

// PostHog project (client-side) API key. This is a public key — it ships in the
// page JS on every deploy — so it's intentionally inlined rather than kept in a
// secret. Swap it if the project changes.
const POSTHOG_KEY = 'phc_zGtiZ59XXiVizCAw9uSRN5ts7PPfDCmdcZSGYkFR3YPK';
const POSTHOG_HOST = 'https://us.i.posthog.com';

export default {
  extends: DefaultTheme,
  Layout: Landing,
  enhanceApp({ router }) {
    // Analytics run in the browser only — skip the SSR/build pass, where there
    // is no window and no navigation to track.
    if (import.meta.env.SSR || typeof window === 'undefined') return;

    import('posthog-js').then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        // VitePress is an SPA: it swaps pages client-side without full reloads,
        // so we capture pageviews manually on route change (below) instead.
        capture_pageview: false,
      });

      // Fire the initial pageview, then one per client-side navigation.
      posthog.capture('$pageview');
      router.onAfterRouteChanged = () => {
        posthog.capture('$pageview');
      };
    });
  },
} satisfies Theme;
