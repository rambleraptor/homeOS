/**
 * Playwright Global Teardown
 *
 * Stops the homestead-server process spawned in global-setup. The data
 * directory is left in place so a test failure can be inspected post-run.
 */

import { stopAepbase } from './aepbase.setup';

async function globalTeardown() {
  console.log('\n\ud83d\uded1 Stopping homestead-server...');
  await stopAepbase();
}

export default globalTeardown;
