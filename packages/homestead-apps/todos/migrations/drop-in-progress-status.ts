/**
 * The `in_progress` todo status was removed. Any existing todo still carrying
 * it would no longer match the collection's enum, so move each one back to
 * `pending` (the bucket it already displayed under).
 */

import type { MigrationHandler } from '@rambleraptor/homestead-core/apps/migrations';
import { aepList, aepUpdate } from '@rambleraptor/homestead-core/server/aepbase';

interface TodoRow {
  id: string;
  status?: string;
}

const migrate: MigrationHandler = async ({ token, log }) => {
  const todos = await aepList<TodoRow>('todos', token);
  let patched = 0;
  for (const todo of todos) {
    if (todo.status !== 'in_progress') continue; // idempotent guard
    await aepUpdate('todos', todo.id, { status: 'pending' }, token);
    if (++patched % 50 === 0) await log(`patched ${patched}…`);
  }
  return { scanned: todos.length, patched };
};

export default migrate;
