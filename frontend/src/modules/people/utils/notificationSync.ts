/**
 * Notification Sync Utility for People Module
 *
 * Handles syncing recurring notifications when people are created/updated.
 * This bridges the gap between the legacy notification_preferences field
 * and the new recurring_notifications system.
 *
 * IMPORTANT: Templates store placeholders ({{name}}, {{date}}) that are resolved
 * at send-time from the source record. This ensures:
 * 1. Name changes are automatically reflected in notifications
 * 2. No template injection vulnerabilities from user-provided names
 */

import { getCollection, pb, Collections } from '@/core/api/pocketbase';
import type { NotificationPreference } from '../types';
import type {
  RecurringNotification,
  NotificationTiming,
} from '@/modules/notifications/types';

// Templates use placeholders that are resolved at send-time from the source record
const BIRTHDAY_TEMPLATES = {
  title: 'Birthday Reminder - {{name}}',
  message: "{{name}}'s birthday is coming up on {{date}}!",
};

const ANNIVERSARY_TEMPLATES = {
  title: 'Anniversary Reminder - {{name}}',
  message: "{{name}}'s anniversary is coming up on {{date}}!",
};

/**
 * Escape a value for use in PocketBase filter strings.
 * Prevents filter injection attacks.
 */
function escapeFilterValue(value: string): string {
  // Escape backslashes first, then double quotes
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Sync recurring notifications for a person based on their notification preferences.
 * This creates/updates/deletes recurring notifications to match the desired timings.
 *
 * @param personId - The ID of the person
 * @param _personName - Unused, kept for API compatibility (name resolved at send-time)
 * @param birthday - The person's birthday (optional)
 * @param anniversary - The person's anniversary (optional)
 * @param preferences - The notification timing preferences
 */
export async function syncRecurringNotificationsForPerson(
  personId: string,
  _personName: string,
  birthday: string | undefined,
  anniversary: string | undefined,
  preferences: NotificationPreference[]
): Promise<void> {
  const userId = pb.authStore.record?.id;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  // Convert NotificationPreference to NotificationTiming (they're the same values)
  const desiredTimings = preferences as NotificationTiming[];

  // Sync birthday and anniversary notifications in parallel
  await Promise.all([
    syncNotificationsForDateField(
      userId,
      personId,
      'birthday',
      birthday,
      desiredTimings,
      BIRTHDAY_TEMPLATES
    ),
    syncNotificationsForDateField(
      userId,
      personId,
      'anniversary',
      anniversary,
      desiredTimings,
      ANNIVERSARY_TEMPLATES
    ),
  ]);
}

/**
 * Sync recurring notifications for a specific date field (birthday or anniversary).
 */
async function syncNotificationsForDateField(
  userId: string,
  personId: string,
  dateField: 'birthday' | 'anniversary',
  dateValue: string | undefined,
  desiredTimings: NotificationTiming[],
  templates: { title: string; message: string }
): Promise<void> {
  const escapedUserId = escapeFilterValue(userId);
  const escapedPersonId = escapeFilterValue(personId);

  // Get existing recurring notifications for this person and date field
  const existing = await getCollection<RecurringNotification>(
    Collections.RECURRING_NOTIFICATIONS
  ).getFullList({
    filter: `user_id="${escapedUserId}" && source_collection="people" && source_id="${escapedPersonId}" && reference_date_field="${dateField}"`,
  });

  const existingTimings = new Map(existing.map((n) => [n.timing, n]));

  // If there's no date value, delete all existing notifications for this field
  if (!dateValue) {
    if (existing.length > 0) {
      await Promise.all(
        existing.map((notification) =>
          getCollection<RecurringNotification>(
            Collections.RECURRING_NOTIFICATIONS
          ).delete(notification.id)
        )
      );
    }
    return;
  }

  // Determine which notifications to create and delete
  const toCreate: NotificationTiming[] = [];
  const toDelete: RecurringNotification[] = [];

  for (const timing of desiredTimings) {
    if (!existingTimings.has(timing)) {
      toCreate.push(timing);
    }
  }

  const desiredSet = new Set(desiredTimings);
  for (const [timing, notification] of existingTimings) {
    if (!desiredSet.has(timing)) {
      toDelete.push(notification);
    }
  }

  // Execute creates and deletes in parallel
  await Promise.all([
    // Create missing notifications
    ...toCreate.map((timing) =>
      getCollection<RecurringNotification>(
        Collections.RECURRING_NOTIFICATIONS
      ).create({
        user_id: userId,
        source_collection: 'people',
        source_id: personId,
        // Store templates with placeholders - resolved at send-time
        title_template: templates.title,
        message_template: templates.message,
        reference_date_field: dateField,
        timing,
        enabled: true,
      })
    ),
    // Delete removed notifications
    ...toDelete.map((notification) =>
      getCollection<RecurringNotification>(
        Collections.RECURRING_NOTIFICATIONS
      ).delete(notification.id)
    ),
  ]);
}

/**
 * Delete all recurring notifications for a person.
 * Call this when a person is deleted.
 */
export async function deleteRecurringNotificationsForPerson(
  personId: string
): Promise<void> {
  const userId = pb.authStore.record?.id;
  if (!userId) {
    return;
  }

  const escapedUserId = escapeFilterValue(userId);
  const escapedPersonId = escapeFilterValue(personId);

  const notifications = await getCollection<RecurringNotification>(
    Collections.RECURRING_NOTIFICATIONS
  ).getFullList({
    filter: `user_id="${escapedUserId}" && source_collection="people" && source_id="${escapedPersonId}"`,
  });

  if (notifications.length > 0) {
    await Promise.all(
      notifications.map((notification) =>
        getCollection<RecurringNotification>(
          Collections.RECURRING_NOTIFICATIONS
        ).delete(notification.id)
      )
    );
  }
}

/**
 * Get notification timings for a person from recurring notifications.
 * This is used to populate the form when editing a person.
 */
export async function getNotificationTimingsForPerson(
  personId: string
): Promise<{ birthday: NotificationTiming[]; anniversary: NotificationTiming[] }> {
  const userId = pb.authStore.record?.id;
  if (!userId) {
    return { birthday: [], anniversary: [] };
  }

  const escapedUserId = escapeFilterValue(userId);
  const escapedPersonId = escapeFilterValue(personId);

  const notifications = await getCollection<RecurringNotification>(
    Collections.RECURRING_NOTIFICATIONS
  ).getFullList({
    filter: `user_id="${escapedUserId}" && source_collection="people" && source_id="${escapedPersonId}"`,
  });

  const result = { birthday: [] as NotificationTiming[], anniversary: [] as NotificationTiming[] };

  for (const notification of notifications) {
    if (notification.reference_date_field === 'birthday') {
      result.birthday.push(notification.timing);
    } else if (notification.reference_date_field === 'anniversary') {
      result.anniversary.push(notification.timing);
    }
  }

  return result;
}
