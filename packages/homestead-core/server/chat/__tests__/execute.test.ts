/**
 * Tests for chat tool execution against the server-side aepbase client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  aepCreate,
  aepGet,
  aepList,
  aepRemove,
  aepUpdate,
} from '../../aepbase';
import { buildTools } from '../tools';
import { executeToolCall } from '../execute';
import type { ResourceDefinition } from '../../../resources/types';

vi.mock('../../aepbase', () => ({
  aepCreate: vi.fn(async () => ({ id: 'new-1' })),
  aepGet: vi.fn(async () => ({ id: 'rec-1' })),
  aepList: vi.fn(async () => [{ id: 'rec-1' }, { id: 'rec-2' }]),
  aepUpdate: vi.fn(async () => ({ id: 'rec-1', updated: true })),
  aepRemove: vi.fn(async () => undefined),
}));

const todo: ResourceDefinition = {
  singular: 'todo',
  plural: 'todos',
  fields: {
    title: { type: 'string', required: true },
    done: { type: 'boolean' },
  },
};

const notification: ResourceDefinition = {
  singular: 'notification',
  plural: 'notifications',
  parents: ['user'],
  fields: {
    title: { type: 'string', required: true },
    subscription_data: { type: 'object' },
  },
};

const TOKEN = 'user-token';
const { bindings } = buildTools([todo, notification]);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeToolCall', () => {
  it('returns ok:false for unknown tools without throwing', async () => {
    const out = await executeToolCall({ name: 'nope', args: {} }, bindings, TOKEN);
    expect(out).toMatchObject({ ok: false, error: expect.stringContaining('unknown tool') });
  });

  it('create maps schema fields to the body and forwards the token', async () => {
    const out = await executeToolCall(
      { name: 'create_todo', args: { title: 'Buy milk', done: false, bogus: 1 } },
      bindings,
      TOKEN,
    );
    expect(out.ok).toBe(true);
    expect(aepCreate).toHaveBeenCalledWith(
      'todos',
      { title: 'Buy milk', done: false },
      TOKEN,
      undefined,
    );
  });

  it('read without id lists; with id gets', async () => {
    const list = await executeToolCall({ name: 'read_todo', args: {} }, bindings, TOKEN);
    expect(aepList).toHaveBeenCalledWith('todos', TOKEN, undefined);
    expect(list.result).toMatchObject({ total: 2 });

    await executeToolCall({ name: 'read_todo', args: { id: 'rec-1' } }, bindings, TOKEN);
    expect(aepGet).toHaveBeenCalledWith('todos', 'rec-1', TOKEN, undefined);
  });

  it('builds the parent path for user-scoped resources', async () => {
    await executeToolCall(
      { name: 'read_notification', args: { user_id: 'u-1' } },
      bindings,
      TOKEN,
    );
    expect(aepList).toHaveBeenCalledWith('notifications', TOKEN, ['users', 'u-1']);
  });

  it('fails recoverably when a parent id is missing', async () => {
    const out = await executeToolCall({ name: 'read_notification', args: {} }, bindings, TOKEN);
    expect(out).toMatchObject({
      ok: false,
      error: expect.stringContaining('user_id'),
    });
    expect(aepList).not.toHaveBeenCalled();
  });

  it('parses JSON-string fields before writing', async () => {
    await executeToolCall(
      {
        name: 'create_notification',
        args: {
          user_id: 'u-1',
          title: 'hi',
          subscription_data: '{"endpoint":"https://x"}',
        },
      },
      bindings,
      TOKEN,
    );
    expect(aepCreate).toHaveBeenCalledWith(
      'notifications',
      { title: 'hi', subscription_data: { endpoint: 'https://x' } },
      TOKEN,
      ['users', 'u-1'],
    );
  });

  it('reports invalid JSON-string fields as recoverable errors', async () => {
    const out = await executeToolCall(
      {
        name: 'create_notification',
        args: { user_id: 'u-1', title: 'hi', subscription_data: 'not json' },
      },
      bindings,
      TOKEN,
    );
    expect(out).toMatchObject({
      ok: false,
      error: expect.stringContaining('subscription_data'),
    });
  });

  it('update requires an id and uses merge-patch helper', async () => {
    const missing = await executeToolCall({ name: 'update_todo', args: {} }, bindings, TOKEN);
    expect(missing.ok).toBe(false);

    await executeToolCall(
      { name: 'update_todo', args: { id: 'rec-1', done: true } },
      bindings,
      TOKEN,
    );
    expect(aepUpdate).toHaveBeenCalledWith('todos', 'rec-1', { done: true }, TOKEN, undefined);
  });

  it('delete removes and reports the id', async () => {
    const out = await executeToolCall(
      { name: 'delete_todo', args: { id: 'rec-9' } },
      bindings,
      TOKEN,
    );
    expect(aepRemove).toHaveBeenCalledWith('todos', 'rec-9', TOKEN, undefined);
    expect(out).toMatchObject({ ok: true, result: { deleted: true, id: 'rec-9' } });
  });

  it('converts aepbase errors into ok:false outcomes', async () => {
    vi.mocked(aepCreate).mockRejectedValueOnce(new Error('create todos → 403'));
    const out = await executeToolCall(
      { name: 'create_todo', args: { title: 'x' } },
      bindings,
      TOKEN,
    );
    expect(out).toMatchObject({ ok: false, error: 'create todos → 403' });
  });
});
