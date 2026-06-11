/**
 * Renders one app's section of the Settings page. Iterates either
 * the app's custom `settingsWidget` (when supplied) or
 * `UserSettingsAutoForm` (when only `userSettings` is declared).
 */

import { Suspense } from 'react';
import { Card } from '@rambleraptor/homestead-core/shared/components/Card';
import {
  AppIcon,
  getLazyComponent,
} from '@rambleraptor/homestead-core/apps/lazy';
import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { UserSettingsAutoForm } from './UserSettingsAutoForm';

interface AppUserSettingsCardProps {
  app: AppConfig;
}

export function AppUserSettingsCard({ app }: AppUserSettingsCardProps) {
  const Widget = app.settingsWidget
    ? getLazyComponent(app.settingsWidget)
    : undefined;
  const settings = app.userSettings;

  return (
    <Card>
      <div className="flex items-start gap-4">
        <AppIcon icon={app.icon} className="w-6 h-6 text-blue-500 mt-1" />
        <div className="flex-1 space-y-4">
          <div>
            <h3
              className="font-semibold text-gray-900"
              data-testid={`user-settings-app-${app.id}`}
            >
              {app.name}
            </h3>
            {app.description ? (
              <p className="mt-1 text-xs text-gray-500">{app.description}</p>
            ) : null}
          </div>
          {Widget ? (
            <Suspense fallback={null}>
              <Widget />
            </Suspense>
          ) : settings ? (
            <UserSettingsAutoForm appId={app.id} defs={settings} />
          ) : null}
        </div>
      </div>
    </Card>
  );
}
