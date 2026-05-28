/**
 * Playwright Configuration for Homestead E2E Tests.
 *
 * aepbase, the Bun sidecar, and the Vite dev server are all managed in
 * `globalSetup` so we can sequence them: aepbase first, then the sidecar
 * (which applies the schema on boot), then the dev server. Vite is on
 * :5173 and aepbase on :8092 (kept off the developer's :8090); the sidecar
 * is on :4002 (off the dev :4000).
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // The repo root, so we can pick up colocated module specs in
  // `packages/homestead-modules/<module>/e2e/` as well as the
  // core specs that still live under `tests/e2e/tests/`.
  testDir: '../..',
  testMatch: [
    'tests/e2e/tests/**/*.spec.ts',
    'packages/homestead-modules/**/e2e/**/*.spec.ts',
  ],

  // Serial because the tests share one aepbase instance and the
  // bootstrap superuser. `fullyParallel: false` only serializes within
  // a file — without `workers: 1` here, two workers can still pick up
  // different specs that both reset admin-owned data (e.g. todos-crud
  // and projects-crud both call `deleteAllTodos(adminToken)` in their
  // beforeEach) and stomp each other mid-test.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  globalSetup: './config/global-setup.ts',
  globalTeardown: './config/global-teardown.ts',
});
