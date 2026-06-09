// Print the AEPBASE_APP_ACCESS value for the e2e aepbase instance.
//
// Run via bun (which handles the app/app graph + JSX) so the Playwright/Node
// harness doesn't have to import those apps directly. Reuses the launcher's
// own serializer so e2e enforcement matches production exactly.
import { appAccessEnv } from '../../../packages/homestead-cli/src/app-access.js';

process.stdout.write(appAccessEnv() ?? '');
