/**
 * Global setup for the *enforced* permissions e2e run.
 *
 * Boots the same single homestead-server process as the default e2e setup, but
 * with permission enforcement turned **on** (`PERMISSIONS_ENFORCED=on`) and the
 * grant cache disabled (`PERMISSION_CACHE_TTL_MS=0`) so a just-written grant is
 * honored on the very next request — no polling for a TTL to lapse.
 *
 * The env vars are set here, before `startAepbase` spawns the server, and the
 * child inherits them via its `...process.env` spread. There's no Vite cache
 * warm-up (the enforced specs drive the HTTP API directly, not the browser), so
 * this stays lean.
 */

import { startAepbase, getAepbaseUrl } from './aepbase.setup';

const OPEN_GRANT_ID = 'open-household';
const SEED_TIMEOUT_MS = 60000;
const POLL_INTERVAL_MS = 250;

/**
 * The permissions baseline (roles + the open-household grant) is seeded *after*
 * the resource sync the default setup already waits on. Under enforcement,
 * nothing is permitted until the open grant exists, so the first test would
 * race ahead of the seed and hit a spurious default-deny. Wait for the grant.
 */
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
  process.env.PERMISSIONS_ENFORCED = 'on';
  process.env.PERMISSION_CACHE_TTL_MS = '0';

  console.log('\n🔒 Starting homestead-server with PERMISSIONS_ENFORCED=on...\n');
  const creds = await startAepbase();
  await waitForOpenGrant(creds.token);
  console.log(`✅ enforced engine at ${getAepbaseUrl()} (open-household grant seeded)`);
  console.log(`   Admin: ${creds.email}\n`);
}

export default globalSetup;
