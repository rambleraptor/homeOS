/**
 * Cross-cutting test data for e2e tests.
 *
 * App-specific fixtures (testGiftCards, testPeople, testRecipes, …)
 * live next to each feature app under
 * `packages/homestead-apps/<app>/e2e/helpers.ts`.
 */

export const testUsers = {
  user1: {
    email: 'user1@test.local',
    password: 'TestPassword123!',
    passwordConfirm: 'TestPassword123!',
    name: 'Test User 1',
  },
  user2: {
    email: 'user2@test.local',
    password: 'TestPassword123!',
    passwordConfirm: 'TestPassword123!',
    name: 'Test User 2',
  },
};
