'use client';

/**
 * Auto-generated form for a module's `userSettings` declarations. The
 * Settings page uses this whenever a module declares `userSettings`
 * but doesn't supply a custom `settingsWidget`.
 *
 * Mirrors the `<FlagField>` switch in
 * `superuser/flag-management/components/FlagManagementHome.tsx` so the
 * two pipelines render identical inputs for identical declarations.
 */

import { Input } from '@rambleraptor/homestead-core/shared/components/Input';
import { Checkbox } from '@rambleraptor/homestead-core/shared/components/Checkbox';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import type { UserSettingDef, UserSettingValue } from '@/modules/types';
import { useUserSettings } from '../hooks/useUserSettings';
import { useUpdateUserSetting } from '../hooks/useUpdateUserSetting';

interface UserSettingsAutoFormProps {
  moduleId: string;
  defs: Record<string, UserSettingDef>;
}

export function UserSettingsAutoForm({
  moduleId,
  defs,
}: UserSettingsAutoFormProps) {
  const { values } = useUserSettings();
  const update = useUpdateUserSetting();
  const toast = useToast();

  const handleChange = async (key: string, value: UserSettingValue) => {
    try {
      await update.mutateAsync({ moduleId, key, value });
    } catch (error) {
      logger.error('Failed to update user setting', error);
      toast.error('Failed to save setting. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      {Object.entries(defs).map(([key, def]) => (
        <UserSettingField
          key={key}
          moduleId={moduleId}
          settingKey={key}
          def={def}
          value={values[moduleId]?.[key]}
          onChange={(next) => handleChange(key, next)}
          isSaving={update.isPending}
        />
      ))}
    </div>
  );
}

interface UserSettingFieldProps {
  moduleId: string;
  settingKey: string;
  def: UserSettingDef;
  value: UserSettingValue | undefined;
  onChange: (value: UserSettingValue) => void;
  isSaving: boolean;
}

function UserSettingField({
  moduleId,
  settingKey,
  def,
  value,
  onChange,
  isSaving,
}: UserSettingFieldProps) {
  const fieldId = `user-setting-${moduleId}-${settingKey}`;
  const testid = `user-setting-${moduleId}-${settingKey}`;

  switch (def.type) {
    case 'string':
      return (
        <div>
          <Input
            id={fieldId}
            label={def.label}
            value={(value as string | undefined) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={isSaving}
            data-testid={testid}
          />
          <p className="mt-1 text-xs text-gray-500">{def.description}</p>
        </div>
      );

    case 'number':
      return (
        <div>
          <Input
            id={fieldId}
            label={def.label}
            type="number"
            value={value === undefined ? '' : String(value)}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange(n);
            }}
            disabled={isSaving}
            data-testid={testid}
          />
          <p className="mt-1 text-xs text-gray-500">{def.description}</p>
        </div>
      );

    case 'boolean':
      return (
        <div className="flex items-start gap-3">
          <Checkbox
            id={fieldId}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(Boolean(checked))}
            disabled={isSaving}
            data-testid={testid}
          />
          <div>
            <label
              htmlFor={fieldId}
              className="text-sm font-medium text-gray-900 cursor-pointer"
            >
              {def.label}
            </label>
            <p className="text-xs text-gray-500">{def.description}</p>
          </div>
        </div>
      );

    case 'enum':
      return (
        <div>
          <label
            htmlFor={fieldId}
            className="block text-sm font-medium text-gray-900 mb-2"
          >
            {def.label}
          </label>
          <select
            id={fieldId}
            value={(value as string | undefined) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={isSaving}
            data-testid={testid}
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          >
            {def.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">{def.description}</p>
        </div>
      );
  }
}
