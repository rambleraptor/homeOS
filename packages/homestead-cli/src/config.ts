import type { CliConfig } from './config-types.ts';
// Via a JS indirection (load-config.js + .d.ts) so `tsc` sees the config as an
// opaque CliConfig instead of following it into the whole app graph;
// `bun build --compile` still bundles the real config. homestead-server reads
// the same config directly (auth.oauth, apps) — no env serialization.
import rootConfig from './load-config.js';

export const homesteadConfig: CliConfig = rootConfig;

/** The git remote + branch `homestead update` tracks, with defaults applied. */
export interface ResolvedGitConfig {
  remote: string;
  branch: string;
}

/** Resolve the `git` block of the loaded config, filling in defaults. */
export function gitConfig(): ResolvedGitConfig {
  const git = homesteadConfig.git ?? {};
  return {
    remote: git.remote ?? 'origin',
    branch: git.branch ?? 'main',
  };
}
