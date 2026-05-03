/**
 * Update the current user's dashboard widget customization preferences.
 *
 * Per-user settings live in a `preferences` child resource under
 * /users/{user_id}. There's no upsert primitive: list, then update the
 * existing record or create a new one.
 *
 * Both fields are stored as JSON-encoded string arrays because
 * aepbase strips JSON-schema constraints on round-trip and storing
 * structured data inside a single string field keeps the schema flat.
 */

import { useMutation } from '@tanstack/react-query';
import { aepbase, AepCollections } from '@rambleraptor/homestead-core/api/aepbase';
import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';

interface UserPreferenceRecord {
  id: string;
  dashboard_widget_order?: string;
  dashboard_hidden_widgets?: string;
}

export interface DashboardWidgetPreferencesInput {
  /** Ordered list of widget ids the user wants to display. */
  order: string[];
  /** Widget ids the user has explicitly hidden. */
  hidden: string[];
}

export function useUpdateDashboardWidgets() {
  const { refreshUser } = useAuth();

  return useMutation({
    mutationFn: async ({ order, hidden }: DashboardWidgetPreferencesInput) => {
      const userId = aepbase.getCurrentUser()?.id;
      if (!userId) throw new Error('User not authenticated');

      const parent = [AepCollections.USERS, userId];
      const payload = {
        dashboard_widget_order: JSON.stringify(order),
        dashboard_hidden_widgets: JSON.stringify(hidden),
      };

      const existing = await aepbase.list<UserPreferenceRecord>(
        AepCollections.USER_PREFERENCES,
        { parent },
      );

      if (existing.length > 0) {
        return await aepbase.update<UserPreferenceRecord>(
          AepCollections.USER_PREFERENCES,
          existing[0].id,
          payload,
          { parent },
        );
      }
      return await aepbase.create<UserPreferenceRecord>(
        AepCollections.USER_PREFERENCES,
        payload,
        { parent },
      );
    },
    onSuccess: async () => {
      await refreshUser();
    },
  });
}
