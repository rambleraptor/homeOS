// Print the AEPBASE_MODULE_ACCESS value for the e2e aepbase instance.
//
// Run via bun (which handles the app/module graph + JSX) so the Playwright/Node
// harness doesn't have to import those modules directly. Reuses the launcher's
// own serializer so e2e enforcement matches production exactly.
import { moduleAccessEnv } from '../../../packages/homestead-cli/src/module-access.js';

process.stdout.write(moduleAccessEnv() ?? '');
