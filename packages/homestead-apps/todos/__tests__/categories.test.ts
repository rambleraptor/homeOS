import { describe, it, expect } from 'vitest';
import {
  groupByCategory,
  groupTodosByCategory,
  sortCategories,
} from '../hooks/useCategories';
import {
  UNCATEGORIZED_ID,
  type Category,
  type TodoItem,
  type TodoStatus,
} from '../types';

function makeCategory(
  id: string,
  name: string,
  position?: number,
  createTime = '2025-01-01T00:00:00Z',
): Category {
  return {
    id,
    path: `projects/p1/categories/${id}`,
    name,
    position,
    create_time: createTime,
    update_time: createTime,
  };
}

function makeTodo(id: string, category?: string): TodoItem {
  const status: TodoStatus = 'pending';
  return {
    id,
    path: `todos/${id}`,
    title: `Todo ${id}`,
    status,
    create_time: '2025-01-01T00:00:00Z',
    update_time: '2025-01-01T00:00:00Z',
    kind: 'family',
    ...(category ? { category } : {}),
  };
}

describe('sortCategories', () => {
  it('orders by ascending position', () => {
    const sorted = sortCategories([
      makeCategory('a', 'A', 2),
      makeCategory('b', 'B', 0),
      makeCategory('c', 'C', 1),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts categories without a position last, create_time as tie-break', () => {
    const sorted = sortCategories([
      makeCategory('x', 'X', undefined, '2025-01-02T00:00:00Z'),
      makeCategory('y', 'Y', 0),
      makeCategory('z', 'Z', undefined, '2025-01-01T00:00:00Z'),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(['y', 'z', 'x']);
  });

  it('does not mutate the input array', () => {
    const input = [makeCategory('a', 'A', 1), makeCategory('b', 'B', 0)];
    sortCategories(input);
    expect(input.map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('groupTodosByCategory', () => {
  const categories = [makeCategory('c1', 'Food', 0), makeCategory('c2', 'Fun', 1)];

  it('groups todos under their category in category order', () => {
    const todos = [
      makeTodo('t1', 'c1'),
      makeTodo('t2', 'c2'),
      makeTodo('t3', 'c1'),
    ];
    const groups = groupTodosByCategory(todos, categories);
    expect(groups.map((g) => g.id)).toEqual(['c1', 'c2']);
    expect(groups[0].items.map((t) => t.id)).toEqual(['t1', 't3']);
    expect(groups[1].items.map((t) => t.id)).toEqual(['t2']);
  });

  it('includes empty categories (managed categories can be empty)', () => {
    const groups = groupTodosByCategory([makeTodo('t1', 'c1')], categories);
    expect(groups.map((g) => g.id)).toEqual(['c1', 'c2']);
    expect(groups[1].items).toEqual([]);
  });

  it('appends an Uncategorized group only when it has items', () => {
    const withUncat = groupTodosByCategory(
      [makeTodo('t1', 'c1'), makeTodo('t2')],
      categories,
    );
    const last = withUncat[withUncat.length - 1];
    expect(last.id).toBe(UNCATEGORIZED_ID);
    expect(last.name).toBeNull();
    expect(last.items.map((t) => t.id)).toEqual(['t2']);

    const noUncat = groupTodosByCategory([makeTodo('t1', 'c1')], categories);
    expect(noUncat.some((g) => g.id === UNCATEGORIZED_ID)).toBe(false);
  });

  it('treats a todo whose category id no longer exists as uncategorized', () => {
    const groups = groupTodosByCategory([makeTodo('t1', 'gone')], categories);
    const last = groups[groups.length - 1];
    expect(last.id).toBe(UNCATEGORIZED_ID);
    expect(last.items.map((t) => t.id)).toEqual(['t1']);
  });

  it('returns just the category groups (all empty) for no todos', () => {
    const groups = groupTodosByCategory([], categories);
    expect(groups.map((g) => g.id)).toEqual(['c1', 'c2']);
    expect(groups.every((g) => g.items.length === 0)).toBe(true);
  });
});

describe('groupByCategory (generic key accessor)', () => {
  it('groups arbitrary items by a custom category field', () => {
    interface Item {
      id: string;
      bucket?: string;
    }
    const items: Item[] = [
      { id: 'a', bucket: 'k1' },
      { id: 'b' },
      { id: 'c', bucket: 'k1' },
    ];
    const groups = groupByCategory(
      items,
      [{ id: 'k1', name: 'Kitchen' }],
      (it) => it.bucket,
    );
    expect(groups.map((g) => g.id)).toEqual(['k1', UNCATEGORIZED_ID]);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['b']);
  });
});
