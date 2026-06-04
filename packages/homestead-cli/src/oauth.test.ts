import { test, expect } from 'bun:test';
import { serializeOAuth } from './oauth.ts';

test('returns undefined when oauth is absent or has no providers', () => {
  expect(serializeOAuth({ modules: [] })).toBeUndefined();
  expect(serializeOAuth({ modules: [], auth: {} })).toBeUndefined();
  expect(
    serializeOAuth({
      modules: [],
      auth: { oauth: { redirectBaseUrl: 'a', successRedirect: 'b', providers: [] } },
    }),
  ).toBeUndefined();
});

test('serializes the oauth block verbatim when providers are present', () => {
  const env = serializeOAuth({
    modules: [],
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
