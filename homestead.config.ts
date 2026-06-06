/**
 * Homestead instance configuration.
 *
 * This is the ONE file you edit to choose what your homestead serves.
 * Comment out a module to remove it; import a new one to add it.
 *
 * The settings and superuser modules are always installed by the
 * registry — you don't list them here. They cover account management
 * and flag management, which the rest of the app depends on.
 */

import {
  creditCardsModule,
  dashboardModule,
  eventsModule,
  gamesModule,
  giftCardsModule,
  groceriesModule,
  hsaModule,
  notificationsModule,
  peopleModule,
  recipesModule,
  todosModule,
} from '@rambleraptor/homestead-modules';
import type { HomesteadConfig } from '@rambleraptor/homestead-core/modules/config';

/**
 * Read an env var. Guarded so this file stays importable in the browser (the
 * SPA registry imports it for `modules`): `process` is undefined there, so the
 * guard short-circuits to `undefined` rather than throwing. Under Bun (the
 * `homestead` launcher) it reads the real environment — which is where OAuth
 * secrets are sourced. Secrets therefore never land in the client bundle.
 */
const fromEnv = (key: string): string | undefined =>
  typeof process !== 'undefined' ? process.env[key] : undefined;

// OAuth is opt-in: enabled only when a provider's client id + secret are set in
// the launcher's environment. Edit this block to add or change providers.
const googleClientId = fromEnv('GOOGLE_OAUTH_CLIENT_ID');
const googleClientSecret = fromEnv('GOOGLE_OAUTH_CLIENT_SECRET');

const auth: HomesteadConfig['auth'] =
  googleClientId && googleClientSecret
    ? {
        oauth: {
          redirectBaseUrl:
            fromEnv('OAUTH_REDIRECT_BASE_URL') ??
            'http://localhost:3000/api/aep',
          successRedirect:
            fromEnv('OAUTH_SUCCESS_REDIRECT') ??
            'http://localhost:3000/auth/callback',
          providers: [
            {
              name: 'google',
              displayName: 'Google',
              clientId: googleClientId,
              clientSecret: googleClientSecret,
              scopes: ['openid', 'email', 'profile'],
              authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
              tokenUrl: 'https://oauth2.googleapis.com/token',
              userInfoUrl:
                'https://openidconnect.googleapis.com/v1/userinfo',
            },
          ],
        },
      }
    : undefined;

const config: HomesteadConfig = {
  modules: [
    dashboardModule,
    todosModule,
    giftCardsModule,
    groceriesModule,
    recipesModule,
    peopleModule,
    eventsModule,
    hsaModule,
    creditCardsModule,
    gamesModule,
    notificationsModule,
  ],
  auth,
  // The directory holding this file is a git checkout. `homestead update`
  // fast-forwards it to this upstream and restarts the service, so config edits
  // (e.g. pushed from a phone) take effect. These are the defaults — omit the
  // block entirely to use them.
  git: {
    remote: 'origin',
    branch: 'main',
  },
};

export default config;
