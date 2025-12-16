/**
 * Playwright Global Setup
 *
 * Runs once before all tests
 */

import { setupPocketBase, startPocketBase, getPocketBaseUrl } from './pocketbase.setup';

async function globalSetup() {
  console.log('\n🔧 Setting up PocketBase for e2e tests...\n');

  await setupPocketBase();
  await startPocketBase();

  // Wait for PocketBase to be fully ready
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`✅ PocketBase started at ${getPocketBaseUrl()}\n`);
}

export default globalSetup;
