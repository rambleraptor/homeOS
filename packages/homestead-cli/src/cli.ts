#!/usr/bin/env bun
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { scaffold, scaffoldApp } from './scaffold.ts';
import { runDoctor, hasFailures, type Check } from './doctor.ts';

async function main(argv: string[]): Promise<number> {
  const [sub, ...rest] = argv;
  switch (sub) {
    case undefined:
    case 'help':
    case '-h':
    case '--help':
      printUsage();
      return 0;
    case 'start':
      return startCmd(rest);
    case 'init':
      return initCmd(rest);
    case 'init-app':
      return initAppCmd(rest);
    case 'doctor':
      return doctorCmd(rest);
    case 'update':
      return updateCmd(rest);
    case 'install-service':
      return installServiceCmd(rest);
    case 'resources': {
      // Lazy import: only `resources` pulls in aep-lib-ts + axios. It also
      // owns its own flag parsing (--@data etc.), so argv passes through raw.
      const { resourcesCmd } = await import('./resources.ts');
      return resourcesCmd(rest);
    }
    case 'admin':
      return adminCmd(rest);
    default:
      printUsage();
      console.error(`\nunknown subcommand ${JSON.stringify(sub)}`);
      return 1;
  }
}

type CliOptions = NonNullable<ParseArgsConfig['options']>;

/**
 * parseArgs in strict mode, with errors turned into a printed message +
 * `null` so commands can return exit code 1 instead of throwing.
 */
function parse(
  args: string[],
  options: CliOptions,
  { positionals = false } = {},
): { values: Record<string, string | boolean | undefined>; positionals: string[] } | null {
  try {
    const parsed = parseArgs({ args, options, strict: true, allowPositionals: positionals });
    return {
      values: parsed.values as Record<string, string | boolean | undefined>,
      positionals: parsed.positionals,
    };
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function startCmd(args: string[]): Promise<number> {
  const parsed = parse(args, {
    dev: { type: 'boolean', default: false },
    port: { type: 'string' },
    'data-dir': { type: 'string' },
  });
  if (!parsed) return 1;
  const { values } = parsed;
  const { runStart } = await import('./supervisor.ts');
  try {
    return await runStart('.', {
      dev: values.dev === true,
      frontendPort: numFlag(values.port, 3000),
      dataDir: strFlag(values['data-dir']),
    });
  } catch (err) {
    console.error(`[homestead] ${err instanceof Error ? err.message : err}`);
    return 1;
  }
}

async function adminCmd(args: string[]): Promise<number> {
  const parsed = parse(
    args,
    {
      'data-dir': { type: 'string' },
      email: { type: 'string' },
    },
    { positionals: true },
  );
  if (!parsed) return 1;
  if (parsed.positionals[0] !== 'reset-password') {
    console.error('usage: homestead admin reset-password [--email=EMAIL] [--data-dir=PATH]');
    return 1;
  }
  const { resetPasswordCmd } = await import('./admin.ts');
  return resetPasswordCmd({
    dataDir: strFlag(parsed.values['data-dir']),
    email: strFlag(parsed.values.email),
  });
}

async function initCmd(args: string[]): Promise<number> {
  const parsed = parse(args, {}, { positionals: true });
  if (!parsed) return 1;
  let root: string;
  try {
    root = scaffold(parsed.positionals[0] ?? '.');
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  console.log(`scaffolded Homestead project at ${root}`);

  // Install up front so `homestead start` is the only remaining step. A
  // failure isn't fatal — start retries the install itself.
  const { findRuntime } = await import('./runtime.ts');
  const { spawnSync } = await import('node:child_process');
  const installCmd = findRuntime(root).install();
  console.log(`installing dependencies (${installCmd.join(' ')})...`);
  const install = spawnSync(installCmd[0]!, installCmd.slice(1), {
    cwd: root,
    stdio: 'inherit',
  });
  if (install.status !== 0) {
    console.error('dependency install failed — `homestead start` will retry it.');
  }

  console.log('\nNext steps:');
  console.log(`  cd ${root}`);
  console.log('  homestead start\n');
  console.log('Edit homestead.config.ts to pick which apps ship, or run');
  console.log('`homestead init-app <name>` — apps under ./apps/ are auto-discovered.');
  return 0;
}

async function initAppCmd(args: string[]): Promise<number> {
  const parsed = parse(args, {}, { positionals: true });
  if (!parsed) return 1;
  const rawName = parsed.positionals[0];
  if (!rawName) {
    console.error('usage: homestead init-app <name>');
    return 1;
  }
  let dir: string;
  let names: ReturnType<typeof scaffoldApp>['names'];
  try {
    ({ dir, names } = scaffoldApp(rawName, '.'));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  console.log(`scaffolded app "${names.display}" at ${dir}`);
  console.log('\nNo wiring needed — apps/*/app.homestead.ts is auto-discovered.');
  console.log('Restart `homestead start` to apply the new app and its resources.');
  return 0;
}

async function doctorCmd(args: string[]): Promise<number> {
  const parsed = parse(args, {
    port: { type: 'string' },
  });
  if (!parsed) return 1;
  const checks = await runDoctor({
    projectDir: '.',
    frontendPort: numFlag(parsed.values.port, 3000),
  });
  for (const c of checks) console.log(formatCheck(c));
  console.log();
  if (hasFailures(checks)) {
    console.log('✗ doctor found failures — fix the items above before `homestead start`');
    return 1;
  }
  console.log('✓ ready for `homestead start`');
  return 0;
}

async function updateCmd(args: string[]): Promise<number> {
  const parsed = parse(args, {
    'service-name': { type: 'string', default: 'homestead' },
    force: { type: 'boolean', default: false },
    'no-restart': { type: 'boolean', default: false },
  });
  if (!parsed) return 1;
  const { runUpdate } = await import('./update.ts');
  return runUpdate({
    projectDir: '.',
    serviceName: strFlag(parsed.values['service-name']) ?? 'homestead',
    force: parsed.values.force === true,
    restart: parsed.values['no-restart'] !== true,
  });
}

async function installServiceCmd(args: string[]): Promise<number> {
  const parsed = parse(args, {
    'update-interval': { type: 'string', default: '5m' },
    'service-name': { type: 'string', default: 'homestead' },
    user: { type: 'string' },
    port: { type: 'string' },
    'data-dir': { type: 'string' },
    'env-file': { type: 'string' },
  });
  if (!parsed) return 1;
  const { installServices, parseInterval } = await import('./service.ts');
  let intervalSeconds: number;
  try {
    intervalSeconds = parseInterval(strFlag(parsed.values['update-interval']) ?? '5m');
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  return installServices({
    projectDir: '.',
    serviceName: strFlag(parsed.values['service-name']) ?? 'homestead',
    user:
      strFlag(parsed.values.user) ?? process.env.SUDO_USER ?? process.env.USER ?? 'root',
    port: numFlag(parsed.values.port, 3000),
    dataDir: strFlag(parsed.values['data-dir']),
    intervalSeconds,
    envFile: strFlag(parsed.values['env-file']),
  });
}

function formatCheck(c: Check): string {
  const mark = c.status === 'ok' ? '✓' : c.status === 'warn' ? '⚠' : '✗';
  return `  ${mark}  ${c.name.padEnd(16)}  ${c.detail}`;
}

function printUsage(): void {
  console.log(
    [
      'homestead — run a Homestead instance from a single binary.',
      '',
      'Usage:',
      '  homestead init [<dir>]      Scaffold a new project (homestead.config.ts + package.json + apps/).',
      '  homestead init-app <name>   Scaffold a new custom app skeleton under ./apps/<name>.',
      '  homestead start [--dev]     Boot the server + SPA using homestead.config.ts in CWD.',
      '  homestead doctor            Check whether the host can run `homestead start`.',
      '  homestead update            Pull the config repo (its git upstream); restart the service if it changed.',
      '  homestead install-service   (Optional) Install the systemd service + auto-update timer (run with sudo).',
      '  homestead resources [...]   CRUD/List resources + their custom methods (run bare to list them).',
      '  homestead admin reset-password  Rotate the superuser password (prints the new one).',
      '',
      'Flags for `start`:',
      '  --dev                       Serve the SPA via Vite (HMR) instead of the cached production build.',
      '  --port=N                    User-facing port; serves the SPA and /api/aep engine (default 3000).',
      '  --data-dir=PATH             server data dir (default <project>/data).',
      '',
      'Flags for `update`:',
      '  --service-name=NAME         systemd service to restart (default homestead).',
      '  --no-restart                Sync the checkout but do not restart the service.',
      '  --force                     Restart even when there are no new commits.',
      '',
      'Flags for `install-service`:',
      '  --update-interval=DUR       Auto-update cadence: 30s, 5m, 2h, or bare minutes (default 5m).',
      '  --service-name=NAME         Base unit name (default homestead).',
      '  --user=NAME                 User the units run as (default $SUDO_USER).',
      '  --port=N                    App port baked into the service (default 3000).',
      '  --data-dir=PATH             server data dir (default <project>/data).',
      '  --env-file=PATH             EnvironmentFile for the units (default <project>/.env if present).',
      '',
      'Flags for `resources`:',
      '  --server-url=URL            Engine base URL (default http://127.0.0.1:<port>/api/aep).',
      '  --port=N                    App port for the engine base URL when --server-url is unset (default 3000).',
      '  --@data=PATH                JSON file supplying a custom method/create body.',
      '  --token=TOKEN               Bearer token; skips the local admin-token mint.',
      '  --email=EMAIL --password=PW Superuser creds; skips the local admin-token mint.',
      '  --data-dir=PATH             Data dir holding the sqlite db (default <project>/data).',
    ].join('\n'),
  );
}

function numFlag(v: string | boolean | undefined, def: number): number {
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return def;
}

function strFlag(v: string | boolean | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

process.exit(await main(process.argv.slice(2)));
