/**
 * Resource definition manifest for the AEP client codegen.
 *
 * Imports the frontend's registry shim (which calls
 * `initializeModuleRegistry` for the operator-chosen modules plus the
 * always-installed core modules), then exports the aggregated list of
 * `ResourceDefinition`s. The codegen consumes the default export.
 *
 * Imported in a Node context via tsx — every module's React + lucide
 * imports get loaded but never rendered.
 */

import '../src/modules/registry';
import { getAllResourceDefs } from '@rambleraptor/homestead-core/modules/registry';
import { BUILTIN_RESOURCE_DEFS } from '@rambleraptor/homestead-core/resources/builtins';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

const defs: ResourceDefinition[] = [
  ...BUILTIN_RESOURCE_DEFS,
  ...getAllResourceDefs(),
];

export default defs;
