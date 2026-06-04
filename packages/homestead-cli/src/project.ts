import { existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

/** Layout of a user's Homestead project directory. */
export interface Project {
  /** Absolute path to the project directory. */
  root: string;
  /** Absolute path to <root>/homestead.config.ts. */
  configPath: string;
  /** Absolute path to <root>/modules, or undefined when absent. */
  modulesDir?: string;
  /** Where aepbase keeps its sqlite db + files. Defaults to <root>/data. */
  dataDir: string;
}

/**
 * Locate a project from `dir` (typically CWD). A directory counts as a project
 * root if it contains homestead.config.ts. We don't walk up to a parent —
 * explicit beats implicit; the binary runs from inside the user's project.
 */
export function loadProject(dir: string): Project {
  const root = resolve(dir);
  const configPath = join(root, 'homestead.config.ts');
  if (!existsSync(configPath)) {
    throw new Error(
      `no homestead.config.ts in ${root} — run \`homestead init\` to scaffold one`,
    );
  }
  const modulesDir = join(root, 'modules');
  return {
    root,
    configPath,
    modulesDir:
      existsSync(modulesDir) && statSync(modulesDir).isDirectory()
        ? modulesDir
        : undefined,
    dataDir: join(root, 'data'),
  };
}
