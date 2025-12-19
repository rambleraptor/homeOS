/**
 * Events E2E Tests - CRUD Operations
 */

import { test, expect } from '../../fixtures/pocketbase.fixture';
import { EventsPage } from '../../pages/EventsPage';
import { testEvents, getFutureDate } from '../../fixtures/test-data';
import { createEvent, deleteAllEvents } from '../../utils/pocketbase-helpers';

test.describe('Events CRUD', () => {
  let eventsPage: EventsPage;

  test.beforeEach(async ({ authenticatedPage, userPocketbase }) => {
    eventsPage = new EventsPage(authenticatedPage);

    // Clean up any existing events
    await deleteAllEvents(userPocketbase);

    await eventsPage.goto();
  });

  test('should create a new one-time event', async ({ page }) => {
    const eventData = {
      name: 'Test Event',
      people_involved: 'John Doe',
      date: getFutureDate(10),
      recurring: false,
    };

    await eventsPage.createEvent(eventData);

    // Verify it appears in the list (EventCard shows people_involved, not title)
    await eventsPage.expectEventInList(eventData.people_involved);
  });

  test('should create a recurring yearly event', async ({ page }) => {
    const eventData = {
      name: "Test Birthday",
      people_involved: 'Jane Smith',
      date: '1990-05-15',
      recurring: true,
      recurrenceType: 'yearly' as const,
    };

    await eventsPage.createEvent(eventData);

    // Verify it appears in the list (EventCard shows people_involved, not title)
    await eventsPage.expectEventInList(eventData.people_involved);
  });

  test('should edit existing event', async ({ userPocketbase }) => {
    // Create an event via API
    const created = await createEvent(userPocketbase, {
      name: 'Original Event',
      people_involved: 'Bob Johnson',
      date: getFutureDate(20),
    });

    await eventsPage.goto();

    // Edit it (EventCard shows people_involved, so we look for that)
    await eventsPage.editEvent('Bob Johnson', {
      name: 'Updated Event',
      people_involved: 'Robert Johnson',
    });

    // Verify the update actually saved to the database
    const updated = await userPocketbase.collection('events').getOne(created.id);
    expect(updated.title).toBe('Updated Event');
    expect(updated.people_involved).toBe('Robert Johnson');

    // Verify the updated name is visible in the UI
    await eventsPage.expectEventInList('Robert Johnson');
    await eventsPage.expectEventNotInList('Bob Johnson');
  });

  test('should delete an event', async ({ userPocketbase }) => {
    // Create an event via API
    await createEvent(userPocketbase, {
      name: 'Event to Delete',
      people_involved: 'Alice Brown',
      date: getFutureDate(15),
    });

    await eventsPage.goto();

    // Delete it (EventCard shows people_involved, not title)
    await eventsPage.deleteEvent('Alice Brown');

    // Verify it's removed
    await eventsPage.expectEventNotInList('Alice Brown');
  });

  test('should create multiple events', async ({ page }) => {
    for (const eventData of testEvents.slice(0, 3)) {
      await eventsPage.createEvent(eventData);
    }

    // Verify all appear in the list (EventCard shows people_involved)
    for (const eventData of testEvents.slice(0, 3)) {
      await eventsPage.expectEventInList(eventData.people_involved || 'Test Person');
    }
  });
});
