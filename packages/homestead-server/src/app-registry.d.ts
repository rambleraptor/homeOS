import type { ResourceCustomMethod } from '@rambleraptor/homestead-core/resources/types';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import type {
  AiConfig,
  AuthServerConfig,
  EmailConfig,
  EmbeddingConfig,
} from '@rambleraptor/homestead-core/apps/config';
import type {
  RegisteredCronHook,
  RegisteredMigration,
} from '@rambleraptor/homestead-core/apps/registry';
import type { AppAccessMap } from '@rambleraptor/homestead-core/apps/access-map';
import type { OAuthConfig } from './engine/oauth';

export function appAccessMap(): AppAccessMap | null;
export function oauthConfig(): OAuthConfig | null;
export function authServerConfig(): AuthServerConfig | null;
export function aiConfig(): AiConfig | null;
export function embeddingConfig(): EmbeddingConfig | null;
export function emailConfig(): EmailConfig | null;

export function getResourceCustomMethod(
  plural: string,
  verb: string,
): ResourceCustomMethod | undefined;
export function getAllResourceCustomMethods(): Record<string, ResourceCustomMethod>;
export function getAllResourceDefs(): ResourceDefinition[];
export function getAllAppFlagDefs(): Record<string, unknown>;
export function getAllUserSettingDefs(): Record<string, unknown>;
export function getAllCronHooks(): RegisteredCronHook[];
export function getAllMigrations(): RegisteredMigration[];
export function handleChat(request: Request): Promise<Response>;
