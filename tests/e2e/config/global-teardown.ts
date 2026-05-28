/**
 * Playwright Global Teardown
 *
 * Stops the dev server, sidecar, and aepbase processes spawned in
 * global-setup. The data directory is left in place so a test failure can
 * be inspected post-run.
 */

import { stopAepbase } from './aepbase.setup';
import { stopSidecar } from './sidecar.setup';
import { stopDevServer } from './dev-server.setup';

async function globalTeardown() {
  console.log('\n🛑 Stopping dev server...');
  await stopDevServer();
  console.log('🛑 Stopping sidecar...');
  await stopSidecar();
  console.log('🛑 Stopping aepbase...');
  await stopAepbase();
}

export default globalTeardown;
