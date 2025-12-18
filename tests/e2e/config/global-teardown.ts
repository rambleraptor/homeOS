/**
 * Playwright Global Teardown
 *
 * Runs once after all tests
 */

import { stopPocketBase } from './pocketbase.setup';

async function globalTeardown() {
  console.log('\n🛑 Stopping PocketBase...\n');
  await stopPocketBase();
}

export default globalTeardown;
