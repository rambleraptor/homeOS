/**
 * Events E2E helpers — seed yearly-recurring household events via the
 * aepbase REST API.
 */

import { deleteIfPresent, e2eClient } from '../../../../tests/e2e/utils/aepbase-helpers';

export interface EventRecord {
  id: string;
  name: string;
  month: number;
  day: number;
  year?: number;
  tag?: string;
  people?: string[];
  recurrence?: 'yearly' | 'yearly-nth-weekday';
  recurrence_rule?: string;
  created_by?: string;
  create_time?: string;
  update_time?: string;
}

interface CreateEventInput {
  name: string;
  /** `YYYY-MM-DD`; split into month/day for the payload (year ignored unless `withYear`). */
  date: string;
  /** Set to also store the date's year as the origin year (for age tests). */
  withYear?: boolean;
  tag?: string;
  /** Pass bare ids; the `people/` prefix is added here. */
  personIds?: string[];
  recurrence?: 'yearly' | 'yearly-nth-weekday';
  recurrence_rule?: string;
}

/** Split a `YYYY-MM-DD` string into numeric parts. */
export function ymdParts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.substring(0, 10).split('-').map(Number);
  return { year, month, day };
}

export async function createEvent(
  token: string,
  data: CreateEventInput,
): Promise<EventRecord> {
  const { year, month, day } = ymdParts(data.date);
  const payload: Record<string, unknown> = {
    name: data.name,
    month,
    day,
  };
  if (data.withYear) payload.year = year;
  if (data.tag) payload.tag = data.tag;
  if (data.personIds && data.personIds.length > 0) {
    payload.people = data.personIds.map((id) => `people/${id}`);
  }
  if (data.recurrence) payload.recurrence = data.recurrence;
  if (data.recurrence_rule) payload.recurrence_rule = data.recurrence_rule;
  return e2eClient(token).collection<EventRecord>('events').create(payload);
}

export async function listEvents(token: string): Promise<EventRecord[]> {
  return e2eClient(token).collection<EventRecord>('events').listAll();
}

export async function deleteAllEvents(token: string) {
  const items = await e2eClient(token).collection<{ id: string }>('events').listAll();
  for (const item of items) {
    await deleteIfPresent(token, 'events', item.id);
  }
}

// ---------------------------------------------------------------------------
// Standalone reminders
// ---------------------------------------------------------------------------

export interface ReminderRecord {
  id: string;
  title: string;
  notes?: string;
  due_at: string;
  status?: 'pending' | 'done';
  /** Id of the app that raised it; unset on one a person created. */
  type?: string;
  source_key?: string;
  notify_users?: string[];
  created_by?: string;
  create_time?: string;
  update_time?: string;
}

interface CreateReminderInput {
  title: string;
  /** RFC3339 instant. Use {@link dueAtFrom} to build one from a wall clock. */
  due_at: string;
  notes?: string;
  status?: 'pending' | 'done';
  /** Seed an app-raised reminder — the kind the list folds away by default. */
  type?: string;
  source_key?: string;
  notify_users?: string[];
}

/**
 * Build a `due_at` from a local wall clock, `n` days from now. Seeding with a
 * fixed calendar date would make "overdue" and "today" assertions drift as the
 * suite ages, so specs express what they mean relative to the run.
 */
export function dueAtFrom(offsetDays: number, hour = 9): string {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offsetDays,
    hour,
  ).toISOString();
}

export async function createReminder(
  token: string,
  data: CreateReminderInput,
): Promise<ReminderRecord> {
  const payload: Record<string, unknown> = {
    title: data.title,
    due_at: data.due_at,
    status: data.status ?? 'pending',
  };
  if (data.notes) payload.notes = data.notes;
  if (data.type) payload.type = data.type;
  if (data.source_key) payload.source_key = data.source_key;
  if (data.notify_users) payload.notify_users = data.notify_users;
  return e2eClient(token).collection<ReminderRecord>('reminders').create(payload);
}

export async function listReminders(token: string): Promise<ReminderRecord[]> {
  return e2eClient(token).collection<ReminderRecord>('reminders').listAll();
}

export async function deleteAllReminders(token: string) {
  const items = await e2eClient(token).collection<{ id: string }>('reminders').listAll();
  for (const item of items) {
    await deleteIfPresent(token, 'reminders', item.id);
  }
}
