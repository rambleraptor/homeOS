import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

/**
 * The Users app manages the built-in `user` collection (owned by aepbase via
 * `EnableUsers = true`) and declares no resources of its own. Account-level
 * audience gating now lives in the permissions system (groups), so the former
 * `account-tag` child resource has been removed.
 */
export const usersResources: ResourceDefinition[] = [];
