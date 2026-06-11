import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Scaffold a starter Homestead project: homestead.config.ts plus an apps/
 * directory. Deliberately minimal — no package.json, no node_modules. Refuses
 * to write into a non-empty directory.
 */
export function scaffold(dir: string): string {
  const root = resolve(dir);
  mkdirSync(root, { recursive: true });

  for (const entry of readdirSync(root)) {
    if (entry !== '.' && entry !== '..') {
      throw new Error(`${root} is not empty — pick a fresh directory`);
    }
  }

  const files: Array<[string, string]> = [
    [join(root, 'homestead.config.ts'), CONFIG_TS],
    [join(root, 'apps', 'README.md'), APPS_README],
    [join(root, '.gitignore'), GITIGNORE],
  ];
  for (const [path, body] of files) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
  return root;
}

const CONFIG_TS = `/**
 * Homestead instance configuration.
 *
 * This is the ONE file you edit to choose what your homestead serves.
 * Comment out an app to remove it; import a new one to add it.
 *
 * To add a custom app, drop a .ts file under ./apps/ exporting a
 * HomeApp, then add the import + array entry below.
 */

import {
  dashboardApp,
  giftCardsApp,
  groceriesApp,
  recipesApp,
  todosApp,
} from '@rambleraptor/homestead-apps';
import type { HomesteadConfig } from '@rambleraptor/homestead-core/apps/config';

const config: HomesteadConfig = {
  apps: [
    dashboardApp,
    todosApp,
    giftCardsApp,
    groceriesApp,
    recipesApp,
  ],

  // Optional: make this directory a git checkout and \`homestead update\` will
  // fast-forward it to the upstream below and restart the service — handy for
  // editing config from a phone. Defaults shown; remove to use them.
  // git: { remote: 'origin', branch: 'main' },
};

export default config;
`;

const APPS_README = `# Custom Apps

Drop .ts files in this directory and import them from
\`../homestead.config.ts\` to add custom features to your Homestead instance.
`;

const GITIGNORE = `# Local server data (sqlite db + uploaded files)
data/

# Launcher cache
.homestead/
`;
