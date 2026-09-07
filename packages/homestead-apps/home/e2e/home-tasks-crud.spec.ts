/**
 * Home E2E Tests — upkeep reminder CRUD.
 *
 * `home-task` is household-wide, so each test clears the whole collection in
 * `beforeEach` rather than relying on per-user scoping.
 */

import { test, expect } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import { HomePage } from './HomePage';
import {
  createHomeTask,
  deleteAllHomeTasks,
  getHomeTask,
  isoDaysFromToday,
  listHomeTasks,
  testHomeTasks,
} from './helpers';

test.describe('Home upkeep CRUD', () => {
  let homePage: HomePage;

  // Seeding happens BEFORE the single per-test navigation: each test's page
  // navigates exactly once, after its API setup, so the UI renders the seeded
  // state without a reload.
  test.beforeEach(async ({ authenticatedPage, userToken }) => {
    homePage = new HomePage(authenticatedPage);
    await deleteAllHomeTasks(userToken);
  });

  test('shows the empty state with no upkeep scheduled', async () => {
    await homePage.goto();
    await homePage.expectEmptyState();
  });

  test('creates a reminder with a cadence and notes', async ({ userToken }) => {
    await homePage.goto();
    await homePage.createTask({
      name: 'Replace furnace filter',
      interval_count: 3,
      interval_unit: 'month',
      next_due: isoDaysFromToday(5),
      notes: '20x25x1, MERV 11',
    });

    await homePage.expectTaskInList('Replace furnace filter');
    await homePage.expectSchedule('Replace furnace filter', 'Every 3 months');
    await homePage.expectNotes('Replace furnace filter', '20x25x1, MERV 11');

    const stored = await listHomeTasks(userToken);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      name: 'Replace furnace filter',
      interval_count: 3,
      interval_unit: 'month',
      notes: '20x25x1, MERV 11',
    });
  });

  test('lists seeded tasks and flags the overdue one', async ({ userToken }) => {
    for (const seed of testHomeTasks) await createHomeTask(userToken, seed);

    await homePage.goto();

    await homePage.expectTaskInList('Replace furnace filter');
    await homePage.expectTaskInList('Clean gutters');
    await homePage.expectUrgency('Clean gutters', /overdue/i);
  });

  test('edits a reminder’s notes', async ({ userToken }) => {
    const task = await createHomeTask(userToken, testHomeTasks[0]);

    await homePage.goto();
    await homePage.editTask(task.name, { notes: '16x25x1, MERV 13' });

    await homePage.expectNotes(task.name, '16x25x1, MERV 13');
    await expect
      .poll(async () => (await getHomeTask(userToken, task.id)).notes)
      .toBe('16x25x1, MERV 13');
  });

  test('marking one done rolls it forward by one interval', async ({ userToken }) => {
    const task = await createHomeTask(userToken, {
      name: 'Test smoke alarms',
      interval_count: 6,
      interval_unit: 'month',
      next_due: isoDaysFromToday(-2),
    });

    await homePage.goto();
    await homePage.expectUrgency(task.name, /overdue/i);
    await homePage.completeTask(task.name);

    // Counted from today (the completion), not from the date it was due.
    await expect
      .poll(async () => (await getHomeTask(userToken, task.id)).last_completed)
      .toBe(isoDaysFromToday(0));
    const rolled = await getHomeTask(userToken, task.id);
    expect(rolled.next_due > isoDaysFromToday(0)).toBe(true);
  });

  test('pauses a reminder without losing its schedule', async ({ userToken }) => {
    const task = await createHomeTask(userToken, testHomeTasks[1]);

    await homePage.goto();
    await homePage.togglePause(task.name);

    await homePage.expectUrgency(task.name, 'Paused');
    await expect
      .poll(async () => (await getHomeTask(userToken, task.id)).paused)
      .toBe(true);
  });

  test('deletes a reminder', async ({ userToken }) => {
    const task = await createHomeTask(userToken, testHomeTasks[0]);

    await homePage.goto();
    await homePage.deleteTask(task.name);

    await homePage.expectTaskNotInList(task.name);
    await expect.poll(async () => (await listHomeTasks(userToken)).length).toBe(0);
  });
});
