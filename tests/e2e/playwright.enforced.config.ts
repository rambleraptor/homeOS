/**
 * Playwright config for the *enforced* permissions e2e run.
 *
 * Same single-server model as the default config, but `globalSetup` boots the
 * server with `PERMISSIONS_ENFORCED=on`, and only the `*.enforced.spec.ts`
 * specs run. These prove that flipping enforcement on — with the seeded
 * open-household grant in place — preserves today's behavior, and that the new
 * deny/break-glass semantics hold end-to-end through the real server.
 *
 * Kept as a separate config (rather than folding into the default suite)
 * because the enforcement mode is a process-wide boot flag: the default suite
 * must keep running with enforcement off, its shipped default.
 *
 * Run with: `npm run test:enforced`
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['tests/permissions/**/*.enforced.spec.ts'],

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  reporter: [
    ['html', { outputFolder: 'playwright-report-enforced', open: 'never' }],
    ['json', { outputFile: 'test-results/results-enforced.json' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  globalSetup: './config/enforced-setup.ts',
  globalTeardown: './config/global-teardown.ts',
});
