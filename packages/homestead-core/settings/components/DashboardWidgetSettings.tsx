'use client';

/**
 * DashboardWidgetSettings
 *
 * Lets the user choose which dashboard widgets are displayed and the
 * order they render in. Widgets are sourced from the module registry
 * (`getAllDashboardWidgets`); the user's choices are persisted on the
 * `user-preference` resource via `useUpdateDashboardWidgets` and
 * picked up by `DashboardHome` through `resolveDashboardWidgets`.
 *
 * Reordering uses up/down buttons rather than a drag-and-drop
 * library: it's keyboard-accessible out of the box and avoids adding
 * a new dependency.
 */

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import { Card } from '@rambleraptor/homestead-core/shared/components/Card';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { getAllDashboardWidgets } from '@/modules/registry';
import { useUpdateDashboardWidgets } from '../hooks/useUpdateDashboardWidgets';
import { resolveDashboardWidgets } from '../utils/resolveDashboardWidgets';

interface WidgetEntry {
  id: string;
  label: string;
  visible: boolean;
}

function buildInitialEntries(
  preferredOrder: string[] | undefined,
  hidden: string[] | undefined,
): WidgetEntry[] {
  const available = getAllDashboardWidgets();
  // Resolve order in the same way the dashboard does, then layer in
  // the hidden ids so the settings UI can show + toggle them.
  const ordered = resolveDashboardWidgets(available, preferredOrder, undefined);
  const hiddenSet = new Set(hidden ?? []);
  return ordered.map((widget) => ({
    id: widget.id,
    label: widget.label ?? widget.id,
    visible: !hiddenSet.has(widget.id),
  }));
}

export function DashboardWidgetSettings() {
  const toast = useToast();
  const { user } = useAuth();
  const updatePrefs = useUpdateDashboardWidgets();

  const [entries, setEntries] = useState<WidgetEntry[]>(() =>
    buildInitialEntries(
      user?.dashboard_widget_order,
      user?.dashboard_hidden_widgets,
    ),
  );

  // Refresh local state if the user record reloads (e.g. after a save
  // refreshUser fires) — keeps the UI consistent with persisted state.
  useEffect(() => {
    setEntries(
      buildInitialEntries(
        user?.dashboard_widget_order,
        user?.dashboard_hidden_widgets,
      ),
    );
  }, [user?.dashboard_widget_order, user?.dashboard_hidden_widgets]);

  const move = (index: number, delta: number) => {
    setEntries((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const toggleVisibility = (id: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, visible: !entry.visible } : entry,
      ),
    );
  };

  const handleSave = async () => {
    try {
      await updatePrefs.mutateAsync({
        order: entries.map((e) => e.id),
        hidden: entries.filter((e) => !e.visible).map((e) => e.id),
      });
      toast.success('Dashboard widgets updated');
    } catch (error) {
      logger.error('Failed to update dashboard widgets', error);
      toast.error('Failed to update dashboard. Please try again.');
    }
  };

  const handleReset = () => {
    setEntries(buildInitialEntries(undefined, undefined));
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Dashboard Widgets
      </h2>

      <Card>
        <div className="flex items-start gap-4">
          <LayoutDashboard className="w-6 h-6 text-blue-500 mt-1" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 mb-2">
              Customize your dashboard
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Choose which widgets appear on your dashboard and the order
              they show up in. Changes only affect what you see — other
              members of your household keep their own layouts.
            </p>

            {entries.length === 0 ? (
              <p
                className="text-sm text-gray-500 italic"
                data-testid="dashboard-widgets-empty"
              >
                No dashboard widgets are available right now.
              </p>
            ) : (
              <ul
                className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden mb-4"
                data-testid="dashboard-widget-list"
              >
                {entries.map((entry, index) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 bg-white"
                    data-testid={`dashboard-widget-row-${entry.id}`}
                  >
                    <span
                      className={
                        entry.visible
                          ? 'text-gray-900 truncate'
                          : 'text-gray-400 line-through truncate'
                      }
                    >
                      {entry.label}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${entry.label} up`}
                        className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        data-testid={`dashboard-widget-up-${entry.id}`}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === entries.length - 1}
                        aria-label={`Move ${entry.label} down`}
                        className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        data-testid={`dashboard-widget-down-${entry.id}`}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleVisibility(entry.id)}
                        aria-label={
                          entry.visible
                            ? `Hide ${entry.label}`
                            : `Show ${entry.label}`
                        }
                        aria-pressed={!entry.visible}
                        className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                        data-testid={`dashboard-widget-toggle-${entry.id}`}
                      >
                        {entry.visible ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleSave}
                disabled={updatePrefs.isPending || entries.length === 0}
                data-testid="dashboard-widgets-save"
              >
                {updatePrefs.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleReset}
                disabled={updatePrefs.isPending}
                data-testid="dashboard-widgets-reset"
              >
                Reset to Defaults
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
