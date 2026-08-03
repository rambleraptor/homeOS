/**
 * The `in_progress` todo status was removed. Any existing todo still carrying
 * it would no longer match the collection's enum, so move each one back to
 * `pending` (the bucket it already displayed under).
 */

import type { MigrationHandler } from '@rambleraptor/homestead-core/apps/migrations';
import { serverClient } from '@rambleraptor/homestead-core/server/client';

interface TodoRow {
  id: string;
  status?: string;
}

const migrate: MigrationHandler = async ({ token, log }) => {
  const collection = serverClient(token).collection<TodoRow>('todos');
  const todos = await collection.listAll();
  let patched = 0;
  for (const todo of todos) {
    if (todo.status !== 'in_progress') continue; // idempotent guard
    await collection.record(todo.id).update({ status: 'pending' });
    if (++patched % 50 === 0) await log(`patched ${patched}…`);
  }
  return { scanned: todos.length, patched };
};

export default migrate;
