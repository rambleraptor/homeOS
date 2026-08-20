/**
 * Reminders section E2E — CRUD via the Events page, plus backend assertions.
 *
 * Reminders live on `/events` as their own section, so this shares the Events
 * page object. Each test seeds through the client and cleans its own rows.
 */

import { test, expect } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import { EventsPage } from './EventsPage';
import {
  createReminder,
  deleteAllReminders,
  dueAtFrom,
  listReminders,
} from './helpers';

test.describe('Reminders CRUD', () => {
  let eventsPage: EventsPage;

  test.beforeEach(async ({ authenticatedPage, userToken }) => {
    eventsPage = new EventsPage(authenticatedPage);
    await deleteAllReminders(userToken);
    await eventsPage.goto();
  });

  test('creates a reminder, defaulting the time when none is given', async ({
    userToken,
  }) => {
    await eventsPage.createReminder({
      title: 'Call the plumber',
      date: '2030-03-04',
    });

    await eventsPage.expectReminderInList('Call the plumber');

    const reminders = await listReminders(userToken);
    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({
      title: 'Call the plumber',
      status: 'pending',
    });
    // No time entered → the section's default hour, in the browser's timezone.
    const due = new Date(reminders[0].due_at);
    expect(due.getHours()).toBe(9);
    expect(due.getMinutes()).toBe(0);
  });

  test('creates a reminder with an explicit time and notes', async ({
    userToken,
  }) => {
    await eventsPage.createReminder({
      title: 'Move the car',
      date: '2030-03-04',
      time: '07:15',
      notes: 'Street cleaning, north side',
    });

    await eventsPage.expectReminderInList('Move the car');

    const reminders = await listReminders(userToken);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].notes).toBe('Street cleaning, north side');
    const due = new Date(reminders[0].due_at);
    expect(due.getHours()).toBe(7);
    expect(due.getMinutes()).toBe(15);
  });

  test('edits an existing reminder', async ({ userToken }) => {
    await createReminder(userToken, {
      title: 'Original title',
      due_at: dueAtFrom(3),
    });

    await eventsPage.goto();
    await eventsPage.expectReminderInList('Original title');
    await eventsPage.editReminder('Original title', {
      title: 'Updated title',
      date: '2030-05-06',
    });

    await eventsPage.expectReminderInList('Updated title');
    await eventsPage.expectReminderNotInList('Original title');

    const reminders = await listReminders(userToken);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].title).toBe('Updated title');
  });

  test('marks a reminder done, which moves it behind the done toggle', async ({
    userToken,
  }) => {
    await createReminder(userToken, {
      title: 'Renew passport',
      due_at: dueAtFrom(5),
    });

    await eventsPage.goto();
    await eventsPage.toggleReminderDone('Renew passport');
    await eventsPage.expectReminderNotInList('Renew passport');

    await eventsPage.showDoneReminders();
    await eventsPage.expectReminderInList('Renew passport');

    const reminders = await listReminders(userToken);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].status).toBe('done');
  });

  test('flags a past-due reminder as overdue', async ({ userToken }) => {
    await createReminder(userToken, {
      title: 'Chase the invoice',
      due_at: dueAtFrom(-2),
    });

    await eventsPage.goto();
    await eventsPage.expectReminderOverdue('Chase the invoice');
  });

  test('deletes a reminder', async ({ userToken }) => {
    await createReminder(userToken, {
      title: 'Cancel the trial',
      due_at: dueAtFrom(1),
    });

    await eventsPage.goto();
    await eventsPage.deleteReminder('Cancel the trial');
    await eventsPage.expectReminderNotInList('Cancel the trial');

    await expect.poll(async () => (await listReminders(userToken)).length).toBe(0);
  });
});
