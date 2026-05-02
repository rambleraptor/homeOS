export type {
  JsonSchemaPrimitive,
  JsonSchemaProperty,
  ResourceDefinition,
  ResourceSchema,
} from './types';
export { BUILTIN_RESOURCE_DEFS } from './builtins';
export {
  syncResourceDefinitions,
  type SyncResourcesOptions,
  type SyncResourcesResult,
} from './sync';
