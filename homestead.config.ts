/**
 * Homestead instance configuration.
 *
 * This is the ONE file you edit to choose what your homestead serves.
 * Comment out an app to remove it; import a new one to add it.
 *
 * The dashboard, notifications, settings, superuser, users, and chat apps
 * are always installed by the registry — you don't list them here. They
 * cover the dashboard, account management, and flag management, which the
 * rest of the app depends on.
 */

import {
  creditCardsApp,
  documentsApp,
  eventsApp,
  gamesApp,
  giftCardsApp,
  groceriesApp,
  hsaApp,
  peopleApp,
  recipesApp,
  todosApp,
} from '@rambleraptor/homestead-apps';
import type { HomesteadConfig } from '@rambleraptor/homestead-core/apps/config';

/**
 * Read an env var. Guarded so this file stays importable in the browser (the
 * SPA registry imports it for `apps`): `process` is undefined there, so the
 * guard short-circuits to `undefined` rather than throwing. On the server
 * (the `homestead` launcher, bun or node) it reads the real environment —
 * which is where OAuth secrets are sourced. Secrets therefore never land in
 * the client bundle.
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

// AI is opt-in: enabled only when an API key is present in the launcher's
// environment. Set the key via AI_API_KEY; with no key set, `ai` is undefined
// and AI endpoints return 503. The defaults below (Gemini) can be overridden
// per-instance:
//   AI_PROVIDER  'openai' (Codex) | 'anthropic' (Claude) | 'google' (Gemini)
//   AI_MODEL     must be vision-capable for the grocery/HSA image features
//   AI_BASE_URL  point at a self-hosted/proxied endpoint (Ollama, vLLM,
//                LiteLLM) speaking that provider's wire format
const aiApiKey = fromEnv('AI_API_KEY');
const ai: HomesteadConfig['ai'] = aiApiKey
  ? {
      provider: (fromEnv('AI_PROVIDER') ??
        'google') as NonNullable<HomesteadConfig['ai']>['provider'],
      model: fromEnv('AI_MODEL') ?? 'gemini-2.5-flash',
      auth: { apiKey: aiApiKey },
      baseURL: fromEnv('AI_BASE_URL'),
    }
  : undefined;

const config: HomesteadConfig = {
  apps: [
    todosApp,
    documentsApp,
    giftCardsApp,
    groceriesApp,
    recipesApp,
    peopleApp,
    eventsApp,
    hsaApp,
    creditCardsApp,
    gamesApp,
  ],
  auth,
  ai,
};

// A running `homestead start` watches this file (and the apps/ tree): edit it
// and the launcher rebuilds the SPA and reapplies config automatically, and
// open tabs reload on their own — no separate update step.

export default config;
