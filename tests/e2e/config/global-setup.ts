/**
 * Playwright Global Setup
 *
 * Runs once before all tests: boots a single homestead-server process
 * (engine API on :8092, SPA via Vite middleware on :5173, schema applied
 * in-process on boot), captures the bootstrap superuser credentials, and
 * pre-warms Vite's module cache so cold transforms don't land inside test
 * timeouts.
 */

import { chromium } from '@playwright/test';
import { startAepbase, getAepbaseUrl, getAppUrl } from './aepbase.setup';

async function globalSetup() {
  console.log('\n🔧 Starting homestead-server for e2e tests...\n');

  const creds = await startAepbase();
  console.log(`✅ engine API at ${getAepbaseUrl()}`);
  console.log(`   Admin: ${creds.email}`);
  console.log(`✅ app at ${getAppUrl()} (schema applied)\n`);

  // Warm-up: drive a throwaway page through login → dashboard once so Vite
  // transforms the SPA's module graph before the first real test. Without
  // this, the first worker's login can blow its navigation timeout waiting
  // on hundreds of cold transforms.
  console.log('🔥 Warming the Vite module cache...');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${getAppUrl()}/login`, { waitUntil: 'networkidle' });
    await page.getByLabel(/email/i).fill(creds.email);
    await page.getByLabel(/password/i).fill(creds.password);
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 120000 });
    await page.waitForLoadState('networkidle');
  } finally {
    await browser.close();
  }
  console.log('✅ warm-up complete\n');
}

export default globalSetup;
