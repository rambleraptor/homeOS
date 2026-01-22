/**
 * Notification Sync Utility for People Module
 *
 * Handles syncing recurring notifications when people are created/updated.
 * This bridges the gap between the legacy notification_preferences field
 * and the new recurring_notifications system.
 */

import { getCollection, pb, Collections } from '@/core/api/pocketbase';
import type { NotificationPreference } from '../types';
import type {
  RecurringNotification,
  NotificationTiming,
} from '@/modules/notifications/types';

const BIRTHDAY_TEMPLATES = {
  title: 'Birthday Reminder - {{name}}',
  message: "{{name}}'s birthday is coming up on {{date}}!",
};

const ANNIVERSARY_TEMPLATES = {
  title: 'Anniversary Reminder - {{name}}',
  message: "{{name}}'s anniversary is coming up on {{date}}!",
};

/**
 * Sync recurring notifications for a person based on their notification preferences.
 * This creates/updates/deletes recurring notifications to match the desired timings.
 *
 * @param personId - The ID of the person
 * @param personName - The name of the person (for templates)
 * @param birthday - The person's birthday (optional)
 * @param anniversary - The person's anniversary (optional)
 * @param preferences - The notification timing preferences
 */
export async function syncRecurringNotificationsForPerson(
  personId: string,
  personName: string,
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

  // Sync birthday notifications
  await syncNotificationsForDateField(
    userId,
    personId,
    personName,
    'birthday',
    birthday,
    desiredTimings,
    BIRTHDAY_TEMPLATES
  );

  // Sync anniversary notifications
  await syncNotificationsForDateField(
    userId,
    personId,
    personName,
    'anniversary',
    anniversary,
    desiredTimings,
    ANNIVERSARY_TEMPLATES
  );
}

/**
 * Sync recurring notifications for a specific date field (birthday or anniversary).
 */
async function syncNotificationsForDateField(
  userId: string,
  personId: string,
  personName: string,
  dateField: 'birthday' | 'anniversary',
  dateValue: string | undefined,
  desiredTimings: NotificationTiming[],
  templates: { title: string; message: string }
): Promise<void> {
  // Get existing recurring notifications for this person and date field
  const existing = await getCollection<RecurringNotification>(
    Collections.RECURRING_NOTIFICATIONS
  ).getFullList({
    filter: `user_id="${userId}" && source_collection="people" && source_id="${personId}" && reference_date_field="${dateField}"`,
  });

  const existingTimings = new Map(existing.map((n) => [n.timing, n]));

  // If there's no date value, delete all existing notifications for this field
  if (!dateValue) {
    for (const notification of existing) {
      await getCollection<RecurringNotification>(
        Collections.RECURRING_NOTIFICATIONS
      ).delete(notification.id);
    }
    return;
  }

  // Process templates with the person's name
  const titleTemplate = templates.title.replace('{{name}}', personName);
  const messageTemplate = templates.message.replace('{{name}}', personName);

  // Create missing notifications
  for (const timing of desiredTimings) {
    if (!existingTimings.has(timing)) {
      await getCollection<RecurringNotification>(
        Collections.RECURRING_NOTIFICATIONS
      ).create({
        user_id: userId,
        source_collection: 'people',
        source_id: personId,
        title_template: titleTemplate,
        message_template: messageTemplate,
        reference_date_field: dateField,
        timing,
        enabled: true,
      });
    }
  }

  // Delete removed notifications
  const desiredSet = new Set(desiredTimings);
  for (const [timing, notification] of existingTimings) {
    if (!desiredSet.has(timing)) {
      await getCollection<RecurringNotification>(
        Collections.RECURRING_NOTIFICATIONS
      ).delete(notification.id);
    }
  }
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

  const notifications = await getCollection<RecurringNotification>(
    Collections.RECURRING_NOTIFICATIONS
  ).getFullList({
    filter: `user_id="${userId}" && source_collection="people" && source_id="${personId}"`,
  });

  for (const notification of notifications) {
    await getCollection<RecurringNotification>(
      Collections.RECURRING_NOTIFICATIONS
    ).delete(notification.id);
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

  const notifications = await getCollection<RecurringNotification>(
    Collections.RECURRING_NOTIFICATIONS
  ).getFullList({
    filter: `user_id="${userId}" && source_collection="people" && source_id="${personId}"`,
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
