/**
 * Playwright Global Setup
 *
 * Runs once before all tests: boots a single homestead-server process
 * (engine API on :8092, SPA via Vite middleware on :5173, schema applied
 * in-process on boot), captures the bootstrap superuser credentials, and
 * pre-warms Vite's module cache so cold transforms don't land inside test
 * timeouts.
 *
 * Enforcement is unconditional in the engine, so the suite always runs against
 * a permissions-enforced server. Two things follow from that:
 *   - We disable the grant cache (`PERMISSION_CACHE_TTL_MS=0`) so a grant a test
 *     creates or deletes is honored on the very next request — no TTL polling.
 *   - We wait for the seeded open-household grant before the first test. The
 *     baseline (roles + open grant) is seeded *after* the resource sync; roles
 *     land first, so until the open grant exists a regular user would hit a
 *     spurious default-deny. Waiting for it keeps the default suite's open
 *     behavior deterministic.
 */

import { chromium } from '@playwright/test';
import { startAepbase, getAepbaseUrl, getAppUrl } from './aepbase.setup';

const OPEN_GRANT_ID = 'open-household';
const SEED_TIMEOUT_MS = 60000;
const POLL_INTERVAL_MS = 250;

async function waitForOpenGrant(token: string): Promise<void> {
  const deadline = Date.now() + SEED_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${getAepbaseUrl()}/access-grants/${OPEN_GRANT_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (res?.ok) return;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Timed out waiting for the open-household grant to be seeded');
}

async function globalSetup() {
  process.env.PERMISSION_CACHE_TTL_MS = '0';

  console.log('\n🔧 Starting homestead-server for e2e tests...\n');

  const creds = await startAepbase();
  console.log(`✅ engine API at ${getAepbaseUrl()}`);
  console.log(`   Admin: ${creds.email}`);
  await waitForOpenGrant(creds.token);
  console.log(`✅ app at ${getAppUrl()} (schema applied, open-household grant seeded)\n`);

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
