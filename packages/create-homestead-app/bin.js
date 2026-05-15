#!/usr/bin/env node
/**
 * `npx create-homestead-app <target>`
 *
 * Copies the template tree into <target>, renames `_gitignore`/`_env.example`
 * to their dotted forms (npm strips real `.gitignore` files at publish time),
 * stamps the project name into the generated package.json, and runs
 * `npm install` so the new directory is ready to `npm run dev`.
 *
 * Pure Node, no dependencies — keep it that way to avoid an `npm install`
 * round-trip just to download the bootstrapper itself.
 */

import { argv, exit, stdout } from 'node:process';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(HERE, 'template');

function usage() {
  stdout.write(`Usage: create-homestead-app <target-directory>

Examples:
  npx create-homestead-app my-home
  npx create-homestead-app ./homes/family
`);
}

function fail(message) {
  stdout.write(`\n[create-homestead-app] ${message}\n`);
  exit(1);
}

function main() {
  const rawTarget = argv[2];
  if (!rawTarget || rawTarget === '--help' || rawTarget === '-h') {
    usage();
    exit(rawTarget ? 0 : 1);
  }

  const target = isAbsolute(rawTarget) ? rawTarget : resolve(process.cwd(), rawTarget);
  const projectName = basename(target);

  if (existsSync(target)) {
    fail(`'${target}' already exists. Pick a fresh directory.`);
  }

  stdout.write(`[create-homestead-app] Scaffolding into ${target}\n`);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(TEMPLATE_DIR, target, { recursive: true });

  // npm strips files literally named .gitignore / .npmrc from a published
  // package, so the template stores them with a `_` prefix and we rename
  // on extraction.
  const renames = [
    ['_gitignore', '.gitignore'],
    ['_env.example', '.env.example'],
  ];
  for (const [from, to] of renames) {
    const src = join(target, from);
    if (existsSync(src)) renameSync(src, join(target, to));
  }

  // Substitute the project name into package.json.
  const pkgPath = join(target, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.name = projectName;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  stdout.write(`[create-homestead-app] Installing dependencies — this can take a minute…\n`);
  const result = spawnSync('npm', ['install'], {
    cwd: target,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    fail(`npm install exited with code ${result.status}. The directory was still created; cd in and run npm install manually.`);
  }

  stdout.write(`
[create-homestead-app] Done.

Next steps:
  1. Start aepbase in a separate terminal (see https://github.com/rambleraptor/homestead#aepbase).
  2. Copy ${projectName}/.env.example to ${projectName}/.env.local and fill in
     AEPBASE_ADMIN_EMAIL / AEPBASE_ADMIN_PASSWORD with the credentials aepbase
     printed on first boot.
  3. cd ${projectName} && npm run dev
  4. Edit ${projectName}/homestead.config.ts to choose which modules to ship.
`);
}

main();
