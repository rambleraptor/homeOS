import { test, expect } from 'bun:test';
import { serializeOAuth } from './oauth.ts';

test('returns undefined when oauth is absent or has no providers', () => {
  expect(serializeOAuth({ apps: [] })).toBeUndefined();
  expect(serializeOAuth({ apps: [], auth: {} })).toBeUndefined();
  expect(
    serializeOAuth({
      apps: [],
      auth: { oauth: { redirectBaseUrl: 'a', successRedirect: 'b', providers: [] } },
    }),
  ).toBeUndefined();
});

test('serializes the oauth block verbatim when providers are present', () => {
  const env = serializeOAuth({
    apps: [],
    auth: {
      oauth: {
        redirectBaseUrl: 'http://x/api/aep',
        successRedirect: 'http://x/cb',
        providers: [{ name: 'google', clientSecret: 'sec' }],
      },
    },
  });
  expect(env).toBeDefined();
  expect(JSON.parse(env!)).toEqual({
    redirectBaseUrl: 'http://x/api/aep',
    successRedirect: 'http://x/cb',
    providers: [{ name: 'google', clientSecret: 'sec' }],
  });
});
