/**
 * Data access for `home-task` — the recurring upkeep schedule.
 *
 * The resource is flat, household-wide, and has no file fields, so the generic
 * offline-capable mutation defaults cover create / update / delete outright and
 * these wrappers only bind the domain names. `useCompleteHomeTask` is the one
 * piece of real logic: "done" isn't a field a person types, it's a rewrite of
 * `last_completed` and `next_due` derived from the task's own cadence.
 */

import { useCallback } from 'react';
import {
  useResourceCreate,
  useResourceDelete,
  useResourceList,
  useResourceUpdate,
} from '@rambleraptor/homestead-core/api/resourceHooks';
import { HOME_TASKS } from '../resources';
import { byDueDate, nextDueAfterCompletion, todayIso } from '../utils/homeTasks';
import type { HomeTask, HomeTaskFormData } from '../types';

/**
 * Every upkeep task, soonest due first with paused schedules parked at the end.
 *
 * `order_by` is sent so the engine returns them in due order, and `sort`
 * layers the paused-last rule on top — including over the optimistic row the
 * mutation factory appends before a refetch confirms it.
 */
export function useHomeTasks() {
  return useResourceList<HomeTask>('home', 'home-task', HOME_TASKS, {
    orderBy: 'next_due',
    sort: byDueDate,
  });
}

export function useCreateHomeTask() {
  return useResourceCreate<HomeTask, HomeTaskFormData>('home', 'home-task');
}

/** Variables are `{ id, data }`; send a field as `null` to clear it (merge-patch). */
export function useUpdateHomeTask() {
  return useResourceUpdate<HomeTask>('home', 'home-task');
}

export function useDeleteHomeTask() {
  return useResourceDelete('home', 'home-task');
}

/**
 * Mark a task done and roll its schedule forward.
 *
 * The new `next_due` is counted from the day it was actually done rather than
 * the day it was due: a filter changed three weeks late still lasts its full
 * three months from the day it went in. Built on the ordinary update mutation,
 * so the roll-forward is optimistic and survives being offline like any edit.
 */
export function useCompleteHomeTask() {
  const update = useUpdateHomeTask();
  const { mutateAsync } = update;

  const complete = useCallback(
    (task: HomeTask, completedOn: string = todayIso()) =>
      mutateAsync({
        id: task.id,
        data: {
          last_completed: completedOn,
          next_due: nextDueAfterCompletion(task, completedOn),
        },
      }),
    [mutateAsync],
  );

  return { complete, isPending: update.isPending };
}
