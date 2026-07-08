/**
 * Events E2E helpers — seed yearly-recurring household events via the
 * aepbase REST API.
 */

import { aepCreate, aepList, aepRemove } from '../../../../tests/e2e/utils/aepbase-helpers';

export interface EventRecord {
  id: string;
  name: string;
  date: string;
  tag?: string;
  people?: string[];
  recurrence?: 'yearly' | 'yearly_nth_weekday';
  recurrence_rule?: string;
  created_by?: string;
  create_time?: string;
  update_time?: string;
}

interface CreateEventInput {
  name: string;
  date: string;
  tag?: string;
  /** Pass bare ids; the `people/` prefix is added here. */
  personIds?: string[];
  recurrence?: 'yearly' | 'yearly_nth_weekday';
  recurrence_rule?: string;
}

export async function createEvent(
  token: string,
  data: CreateEventInput,
): Promise<EventRecord> {
  const payload: Record<string, unknown> = {
    name: data.name,
    date: data.date,
  };
  if (data.tag) payload.tag = data.tag;
  if (data.personIds && data.personIds.length > 0) {
    payload.people = data.personIds.map((id) => `people/${id}`);
  }
  if (data.recurrence) payload.recurrence = data.recurrence;
  if (data.recurrence_rule) payload.recurrence_rule = data.recurrence_rule;
  return aepCreate<EventRecord>(token, 'events', payload);
}

export async function listEvents(token: string): Promise<EventRecord[]> {
  return aepList<EventRecord>(token, 'events');
}

export async function deleteAllEvents(token: string) {
  const items = await aepList<{ id: string }>(token, 'events');
  for (const item of items) {
    await aepRemove(token, 'events', item.id);
  }
}
