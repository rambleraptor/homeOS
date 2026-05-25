/**
 * Codegen entry point. Invoked from the frontend's `predev`/`prebuild`
 * scripts so the generated client is present whenever TypeScript
 * compiles. Receives the path to a resource-defs module — that module
 * must default-export `ResourceDefinition[]`. The frontend ships
 * `frontend/scripts/aep-client-defs.ts` which initializes the module
 * registry, then exports the aggregated list (builtins + every module).
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import { generate } from '../src/codegen/generate';

async function main(): Promise<void> {
  const [defsPathArg, outDirArg] = process.argv.slice(2);
  if (!defsPathArg || !outDirArg) {
    throw new Error(
      'Usage: generate-client <defs-module-path> <out-dir>\n' +
        '  defs-module-path: TS/JS file whose default export is ResourceDefinition[]\n' +
        '  out-dir: directory to write generated files into',
    );
  }

  const defsAbs = resolve(process.cwd(), defsPathArg);
  const outAbs = resolve(process.cwd(), outDirArg);

  const mod = (await import(pathToFileURL(defsAbs).href)) as {
    default?: ResourceDefinition[];
  };
  const defs = mod.default;
  if (!Array.isArray(defs)) {
    throw new Error(
      `${defsPathArg}: default export must be ResourceDefinition[]`,
    );
  }

  await generate({ defs, outDir: outAbs });
  console.log(
    `[aep-client] generated ${defs.length} resources → ${outDirArg}`,
  );
}

main().catch((err) => {
  console.error('[aep-client] generation failed:', err);
  process.exit(1);
});
