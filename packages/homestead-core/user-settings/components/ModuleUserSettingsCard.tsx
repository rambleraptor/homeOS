/**
 * Renders one module's section of the Settings page. Iterates either
 * the module's custom `settingsWidget` (when supplied) or
 * `UserSettingsAutoForm` (when only `userSettings` is declared).
 */

import { Suspense } from 'react';
import { Card } from '@rambleraptor/homestead-core/shared/components/Card';
import {
  ModuleIcon,
  getLazyComponent,
} from '@rambleraptor/homestead-core/modules/lazy';
import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import { UserSettingsAutoForm } from './UserSettingsAutoForm';

interface ModuleUserSettingsCardProps {
  module: HomeModule;
}

export function ModuleUserSettingsCard({ module }: ModuleUserSettingsCardProps) {
  const Widget = module.settingsWidget
    ? getLazyComponent(module.settingsWidget)
    : undefined;
  const settings = module.userSettings;

  return (
    <Card>
      <div className="flex items-start gap-4">
        <ModuleIcon icon={module.icon} className="w-6 h-6 text-blue-500 mt-1" />
        <div className="flex-1 space-y-4">
          <div>
            <h3
              className="font-semibold text-gray-900"
              data-testid={`user-settings-module-${module.id}`}
            >
              {module.name}
            </h3>
            {module.description ? (
              <p className="mt-1 text-xs text-gray-500">{module.description}</p>
            ) : null}
          </div>
          {Widget ? (
            <Suspense fallback={null}>
              <Widget />
            </Suspense>
          ) : settings ? (
            <UserSettingsAutoForm moduleId={module.id} defs={settings} />
          ) : null}
        </div>
      </div>
    </Card>
  );
}
