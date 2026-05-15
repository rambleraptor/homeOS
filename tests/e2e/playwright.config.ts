/**
 * Playwright Configuration for Homestead E2E Tests.
 *
 * Both aepbase and the Next.js dev server are managed in
 * `globalSetup` so we can guarantee aepbase is up before the dev
 * server's instrumentation hook tries to push the schema. The dev
 * server is launched on :3000 and aepbase on :8092 (kept off the
 * developer's :8090).
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

  // Serial because the tests share one aepbase instance + admin user.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:3000',
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
