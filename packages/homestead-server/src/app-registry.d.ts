import type { ResourceCustomMethod } from '@rambleraptor/homestead-core/resources/types';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import type { AppAccessConfig } from './engine/access';
import type { OAuthConfig } from './engine/oauth';

export function appAccessMap(): AppAccessConfig | null;
export function oauthConfig(): OAuthConfig | null;

export function getResourceCustomMethod(
  plural: string,
  verb: string,
): ResourceCustomMethod | undefined;
export function getAllResourceCustomMethods(): Record<string, ResourceCustomMethod>;
export function getAllResourceDefs(): ResourceDefinition[];
export function getAllAppFlagDefs(): Record<string, unknown>;
export function getAllUserSettingDefs(): Record<string, unknown>;
export function handleChat(request: Request): Promise<Response>;
