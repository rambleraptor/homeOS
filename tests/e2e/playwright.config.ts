/**
 * Playwright Configuration for Homestead E2E Tests.
 *
 * A single homestead-server process is managed in `globalSetup`, on one port
 * (:5173, kept off the developer's :3000): the SPA via Vite middleware and the
 * engine under /api/aep. The schema is applied in-process on boot.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // The repo root, so we can pick up colocated app specs in
  // `packages/homestead-apps/<app>/e2e/` as well as the
  // core specs that still live under `tests/e2e/tests/`.
  testDir: '../..',
  testMatch: [
    'tests/e2e/tests/**/*.spec.ts',
    'packages/homestead-apps/**/e2e/**/*.spec.ts',
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

    // Emulate the OS "reduce motion" setting, which the global guard in
    // `globals.css` collapses every transition and animation down to. This is
    // a real user configuration, not a test-only shortcut — the suite just
    // happens to want the same thing users on that setting want.
    //
    // It also removes a whole class of flake at the source. An element that is
    // mid-fade or mid-slide is present in the DOM but not yet at its final
    // position or opacity, so clicks land on the wrong target and screenshots
    // catch a frame in transit. The house rule against `waitForTimeout` (see
    // CLAUDE.md) only holds if there's nothing to wait out.
    reducedMotion: 'reduce',
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
