/**
 * Homestead instance configuration.
 *
 * This is the ONE file you edit to choose what your homestead serves.
 * Comment out an app to remove it; import a new one to add it.
 *
 * The settings and superuser apps are always installed by the
 * registry — you don't list them here. They cover account management
 * and flag management, which the rest of the app depends on.
 */

import {
  creditCardsApp,
  dashboardApp,
  eventsApp,
  gamesApp,
  giftCardsApp,
  groceriesApp,
  hsaApp,
  notificationsApp,
  peopleApp,
  recipesApp,
  todosApp,
} from '@rambleraptor/homestead-apps';
import type { HomesteadConfig } from '@rambleraptor/homestead-core/apps/config';

/**
 * Read an env var. Guarded so this file stays importable in the browser (the
 * SPA registry imports it for `apps`): `process` is undefined there, so the
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
  apps: [
    dashboardApp,
    todosApp,
    giftCardsApp,
    groceriesApp,
    recipesApp,
    peopleApp,
    eventsApp,
    hsaApp,
    creditCardsApp,
    gamesApp,
    notificationsApp,
  ],
  auth,
};

// The directory holding this file is a git checkout. `homestead update`
// fast-forwards it to the checkout's upstream (origin/main unless you change
// it with `git branch -u`) and restarts the service, so config edits — e.g.
// pushed from a phone — take effect.

export default config;
