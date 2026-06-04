// Runtime loader for the operator's config. Implemented in JS (with a
// hand-written load-config.d.ts) so the CLI's `tsc` doesn't follow the static
// import into the entire app/module graph — those .tsx files are type-checked
// by the frontend project, under its DOM + JSX config, not ours.
//
// `bun build --compile` still follows this import and bundles homestead.config
// (and its module graph) into the binary.
import config from '../../../homestead.config.ts';

export default config;
