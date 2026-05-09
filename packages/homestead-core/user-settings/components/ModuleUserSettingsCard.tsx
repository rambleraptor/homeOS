'use client';

/**
 * Renders one module's section of the Settings page. Iterates either
 * the module's custom `settingsWidget` (when supplied) or
 * `UserSettingsAutoForm` (when only `userSettings` is declared).
 */

import { Card } from '@rambleraptor/homestead-core/shared/components/Card';
import type { HomeModule } from '@/modules/types';
import { UserSettingsAutoForm } from './UserSettingsAutoForm';

interface ModuleUserSettingsCardProps {
  module: HomeModule;
}

export function ModuleUserSettingsCard({ module }: ModuleUserSettingsCardProps) {
  const Icon = module.icon;
  const Widget = module.settingsWidget;
  const settings = module.userSettings;

  return (
    <Card>
      <div className="flex items-start gap-4">
        <Icon className="w-6 h-6 text-blue-500 mt-1" />
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
            <Widget />
          ) : settings ? (
            <UserSettingsAutoForm moduleId={module.id} defs={settings} />
          ) : null}
        </div>
      </div>
    </Card>
  );
}
