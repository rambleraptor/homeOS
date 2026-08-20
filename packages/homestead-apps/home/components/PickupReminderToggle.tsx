/**
 * The "remind me the night before" opt-in, sitting on the pickup section it
 * governs.
 *
 * The setting is declared on the app (`pickup_reminder`), so it already renders
 * on the Settings page for free — but nobody goes to Settings to answer a
 * question they only ever have while looking at the bin calendar. This is the
 * same value, offered where it occurs to you.
 *
 * Switching it on doesn't create anything by itself: the `home-pickup-reminders`
 * cron picks the change up on its next run (and at boot) and writes the
 * reminders, which the evening reminder cron delivers at 6pm the night before
 * each collection.
 */

import { BellOff, BellRing } from 'lucide-react';
import { useUserSetting } from '@rambleraptor/homestead-core/user-settings';
import { PICKUP_REMINDER_SETTING } from '../pickupReminderSetting';

export function PickupReminderToggle() {
  const { value, setValue, isLoading, isSaving } = useUserSetting<boolean>(
    'home',
    PICKUP_REMINDER_SETTING,
  );
  const enabled = value === true;
  const Icon = enabled ? BellRing : BellOff;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={isLoading || isSaving}
      onClick={() => {
        // Errors surface through the global mutation error toast
        // (queryClient.ts); the switch simply stays where it was.
        void setValue(!enabled);
      }}
      data-testid="home-pickup-reminder-toggle"
      title={
        enabled
          ? 'You get a reminder at 6pm the night before each collection'
          : 'Get a reminder at 6pm the night before each collection'
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        enabled
          ? 'border-brand-navy/20 bg-gray-50 text-brand-navy'
          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {enabled ? 'Reminding me' : 'Remind me the night before'}
    </button>
  );
}
