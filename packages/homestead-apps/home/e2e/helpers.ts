/**
 * Home E2E helpers — seed and clear the household's upkeep schedule via the
 * aepbase REST API. `home-task` is a flat, household-wide collection, so a
 * regular member's token can both write and clean up.
 */

import { deleteIfPresent, e2eClient } from '../../../../tests/e2e/utils/aepbase-helpers';

export interface HomeTaskRecord {
  id: string;
  name: string;
  notes?: string;
  interval_count: number;
  interval_unit: 'day' | 'week' | 'month' | 'year';
  next_due: string;
  last_completed?: string;
  lead_days?: number;
  paused?: boolean;
}

export type HomeTaskSeed = Omit<HomeTaskRecord, 'id'>;

/** ISO `YYYY-MM-DD` `days` from today, so seeds don't rot as the calendar moves. */
export function isoDaysFromToday(days: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const testHomeTasks: HomeTaskSeed[] = [
  {
    name: 'Replace furnace filter',
    notes: '20x25x1, MERV 11 — spares are on the shelf by the water heater',
    interval_count: 3,
    interval_unit: 'month',
    next_due: isoDaysFromToday(5),
  },
  {
    name: 'Clean gutters',
    interval_count: 6,
    interval_unit: 'month',
    next_due: isoDaysFromToday(-3),
    lead_days: 7,
  },
];

function tasks(token: string) {
  return e2eClient(token).collection<HomeTaskRecord>('home-tasks');
}

export async function createHomeTask(
  token: string,
  data: HomeTaskSeed,
): Promise<HomeTaskRecord> {
  return tasks(token).create(data);
}

export async function listHomeTasks(token: string): Promise<HomeTaskRecord[]> {
  return tasks(token).listAll();
}

export async function getHomeTask(token: string, id: string): Promise<HomeTaskRecord> {
  return tasks(token).get(id);
}

/** The collection is household-wide, so this clears every task on the instance. */
export async function deleteAllHomeTasks(token: string) {
  for (const task of await listHomeTasks(token)) {
    await deleteIfPresent(token, 'home-tasks', task.id);
  }
}
