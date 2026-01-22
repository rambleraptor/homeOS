/**
 * People E2E Tests - Notification Preferences & Recurring Notifications
 *
 * Tests the notification preference system including:
 * - Setting notification preferences when creating a person
 * - Updating notification preferences
 * - Verifying recurring notifications are created in the database
 * - Verifying recurring notifications are deleted when person is deleted
 */

import { test, expect } from '../../fixtures/pocketbase.fixture';
import { PeoplePage } from '../../pages/PeoplePage';
import {
  createPerson,
  deleteAllPeople,
  getRecurringNotificationsForPerson,
  deleteAllRecurringNotifications
} from '../../utils/pocketbase-helpers';

test.describe('People Notification Preferences', () => {
  let peoplePage: PeoplePage;

  test.beforeEach(async ({ authenticatedPage, userPocketbase }) => {
    peoplePage = new PeoplePage(authenticatedPage);

    // Clean up any existing people and recurring notifications
    await deleteAllPeople(userPocketbase);
    await deleteAllRecurringNotifications(userPocketbase);

    await peoplePage.goto();
  });

  test('should create recurring notifications when creating person with birthday', async ({ userPocketbase }) => {
    const personData = {
      name: 'John Birthday',
      birthday: '1990-06-15',
      notificationPreferences: ['day_of', 'week_before'] as const,
    };

    await peoplePage.createPersonWithNotifications(personData);
    await peoplePage.expectPersonInList(personData.name);

    // Verify person was created
    const people = await userPocketbase.collection('people').getFullList({
      filter: `name = "${personData.name}"`,
    });
    expect(people.length).toBe(1);

    // Verify recurring notifications were created
    const notifications = await getRecurringNotificationsForPerson(userPocketbase, people[0].id);

    // Should have 2 notifications for birthday (day_of and week_before)
    const birthdayNotifications = notifications.filter(n => n.reference_date_field === 'birthday');
    expect(birthdayNotifications.length).toBe(2);

    // Verify timings
    const timings = birthdayNotifications.map(n => n.timing).sort();
    expect(timings).toEqual(['day_of', 'week_before']);

    // Verify templates contain placeholders (not pre-resolved)
    for (const notification of birthdayNotifications) {
      expect(notification.title_template).toContain('{{name}}');
      expect(notification.message_template).toContain('{{name}}');
      expect(notification.message_template).toContain('{{date}}');
      expect(notification.enabled).toBe(true);
    }
  });

  test('should create recurring notifications for both birthday and anniversary', async ({ userPocketbase }) => {
    const personData = {
      name: 'Jane Both',
      birthday: '1985-03-20',
      anniversary: '2010-07-04',
      notificationPreferences: ['day_before'] as const,
    };

    await peoplePage.createPersonWithNotifications(personData);
    await peoplePage.expectPersonInList(personData.name);

    // Verify person was created
    const people = await userPocketbase.collection('people').getFullList({
      filter: `name = "${personData.name}"`,
    });
    expect(people.length).toBe(1);

    // Verify recurring notifications were created
    const notifications = await getRecurringNotificationsForPerson(userPocketbase, people[0].id);

    // Should have 1 notification for birthday + 1 for anniversary
    const birthdayNotifications = notifications.filter(n => n.reference_date_field === 'birthday');
    const anniversaryNotifications = notifications.filter(n => n.reference_date_field === 'anniversary');

    expect(birthdayNotifications.length).toBe(1);
    expect(anniversaryNotifications.length).toBe(1);
    expect(birthdayNotifications[0].timing).toBe('day_before');
    expect(anniversaryNotifications[0].timing).toBe('day_before');
  });

  test('should update recurring notifications when editing person preferences', async ({ userPocketbase }) => {
    // Create person with initial preferences
    const created = await createPerson(userPocketbase, {
      name: 'Update Test',
      birthday: '1995-12-25',
    });

    await peoplePage.goto();

    // Edit and change notification preferences
    await peoplePage.editPersonNotifications('Update Test', ['day_before', 'week_before']);

    // Verify recurring notifications were updated
    const notifications = await getRecurringNotificationsForPerson(userPocketbase, created.id);

    const birthdayNotifications = notifications.filter(n => n.reference_date_field === 'birthday');
    expect(birthdayNotifications.length).toBe(2);

    const timings = birthdayNotifications.map(n => n.timing).sort();
    expect(timings).toEqual(['day_before', 'week_before']);
  });

  test('should delete recurring notifications when person is deleted', async ({ userPocketbase }) => {
    // Create person with notifications
    const created = await createPerson(userPocketbase, {
      name: 'Delete Test',
      birthday: '2000-01-01',
    });

    // Verify recurring notifications exist
    let notifications = await getRecurringNotificationsForPerson(userPocketbase, created.id);
    expect(notifications.length).toBeGreaterThan(0);

    // Delete the person
    await peoplePage.goto();
    await peoplePage.deletePerson('Delete Test');

    // Verify recurring notifications were deleted
    notifications = await getRecurringNotificationsForPerson(userPocketbase, created.id);
    expect(notifications.length).toBe(0);
  });

  test('should not create recurring notifications when no dates are set', async ({ userPocketbase }) => {
    const personData = {
      name: 'No Dates Person',
      notificationPreferences: ['day_of', 'day_before', 'week_before'] as const,
    };

    await peoplePage.createPersonWithNotifications(personData);
    await peoplePage.expectPersonInList(personData.name);

    // Verify person was created
    const people = await userPocketbase.collection('people').getFullList({
      filter: `name = "${personData.name}"`,
    });
    expect(people.length).toBe(1);

    // Verify no recurring notifications were created (no dates = no notifications)
    const notifications = await getRecurringNotificationsForPerson(userPocketbase, people[0].id);
    expect(notifications.length).toBe(0);
  });

  test('should remove recurring notifications when preferences are cleared', async ({ userPocketbase }) => {
    // Create person with preferences
    const personData = {
      name: 'Clear Prefs Test',
      birthday: '1990-05-05',
      notificationPreferences: ['day_of', 'day_before', 'week_before'] as const,
    };

    await peoplePage.createPersonWithNotifications(personData);

    // Verify person was created
    const people = await userPocketbase.collection('people').getFullList({
      filter: `name = "${personData.name}"`,
    });
    expect(people.length).toBe(1);

    // Verify notifications exist
    let notifications = await getRecurringNotificationsForPerson(userPocketbase, people[0].id);
    expect(notifications.length).toBe(3); // All 3 preferences for birthday

    // Edit and clear all preferences
    await peoplePage.editPersonNotifications('Clear Prefs Test', []);

    // Verify recurring notifications were removed
    notifications = await getRecurringNotificationsForPerson(userPocketbase, people[0].id);
    expect(notifications.length).toBe(0);
  });
});
