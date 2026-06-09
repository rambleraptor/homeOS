/**
 * Playwright Global Setup
 *
 * Runs once before all tests. Brings up the e2e stack in order:
 *   1. a dedicated aepbase instance (captures the bootstrap superuser)
 *   2. the Bun sidecar — applies the resource/flag/setting schema and
 *      serves the notifications/app-worker API routes
 *   3. the Vite dev server — serves the SPA and proxies /api/* to the two
 *      above
 * aepbase must be up before the sidecar (which talks to it on boot), and
 * the sidecar before the dev server, so we sequence them here rather than
 * via Playwright's `webServer`.
 */

import { startAepbase, getAepbaseUrl } from './aepbase.setup';
import { startSidecar, getSidecarUrl } from './sidecar.setup';
import { startDevServer, getDevServerUrl } from './dev-server.setup';

async function globalSetup() {
  console.log('\n🔧 Setting up aepbase for e2e tests...\n');

  const creds = await startAepbase();
  console.log(`✅ aepbase running at ${getAepbaseUrl()}`);
  console.log(`   Admin: ${creds.email}`);

  console.log('🚀 Starting sidecar (applies schema)...');
  await startSidecar(creds);
  console.log(`✅ Sidecar ready at ${getSidecarUrl()} (schema applied)`);

  console.log('🚀 Starting Vite dev server...');
  await startDevServer(creds);
  console.log(`✅ Dev server ready at ${getDevServerUrl()}\n`);
}

export default globalSetup;
