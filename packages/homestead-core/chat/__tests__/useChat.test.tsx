/**
 * Tests for the ephemeral chat hook: transport shape, transcript
 * handling, and the not-configured / error states.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useChat } from '../hooks/useChat';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const renderUseChat = () => renderHook(() => useChat(), { wrapper: createWrapper() });

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const okResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('useChat', () => {
  it('posts the transcript with auth headers and appends the reply', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse({
        reply: 'Done!',
        toolCalls: [{ tool: 'create_todo', args: {}, ok: true }],
      }),
    );

    const { result } = renderUseChat();
    await act(() => result.current.send('Add milk'));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'X-User-Id': 'test-user-id',
        }),
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Add milk' }],
        }),
      }),
    );
    expect(result.current.messages).toEqual([
      { role: 'user', content: 'Add milk' },
      {
        role: 'assistant',
        content: 'Done!',
        toolCalls: [{ tool: 'create_todo', args: {}, ok: true }],
      },
    ]);
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('strips display-only toolCalls from the outgoing transcript', async () => {
    fetchMock.mockResolvedValue(okResponse({ reply: 'ok', toolCalls: [] }));

    const { result } = renderUseChat();
    await act(() => result.current.send('first'));
    await act(() => result.current.send('second'));

    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body.messages).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'second' },
    ]);
  });

  it('flags notConfigured on 503 and keeps the transcript', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }));

    const { result } = renderUseChat();
    await act(() => result.current.send('hello'));

    expect(result.current.notConfigured).toBe(true);
    expect(result.current.messages).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('surfaces the full server error (status + detail) and keeps the transcript', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'Bad gateway', message: 'Gemini exploded' }),
        { status: 502 },
      ),
    );

    const { result } = renderUseChat();
    await act(() => result.current.send('hello'));

    expect(result.current.error).toBe('HTTP 502: Bad gateway: Gemini exploded');
    expect(result.current.messages).toEqual([{ role: 'user', content: 'hello' }]);
    expect(result.current.pending).toBe(false);
  });

  it('surfaces a non-JSON error body as raw text', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('upstream timeout', { status: 504 }),
    );

    const { result } = renderUseChat();
    await act(() => result.current.send('hello'));

    expect(result.current.error).toBe('HTTP 504: upstream timeout');
    expect(result.current.messages).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('ignores blank input', async () => {
    const { result } = renderUseChat();
    await act(() => result.current.send('   '));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });
});
