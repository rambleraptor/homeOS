import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatHome } from '../components/ChatHome';
import * as useChatMod from '../hooks/useChat';

function mockChat(over: Partial<ReturnType<typeof useChatMod.useChat>>) {
  vi.spyOn(useChatMod, 'useChat').mockReturnValue({
    messages: [],
    pending: false,
    error: null,
    notConfigured: false,
    send: vi.fn(),
    ...over,
  });
}

describe('ChatHome', () => {
  it('renders empty state + composer', () => {
    mockChat({});
    render(<ChatHome />);
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    expect(screen.getByText(/Start a conversation/i)).toBeInTheDocument();
  });

  it('renders bubbles + tool markers + pending', () => {
    mockChat({
      messages: [
        { role: 'user', content: 'add milk to groceries' },
        {
          role: 'assistant',
          content: 'Done! Added milk.',
          toolCalls: [
            { tool: 'create_grocery_item', ok: true },
            { tool: 'read_todo', ok: false, error: 'boom' },
          ],
        },
      ],
      pending: true,
    });
    render(<ChatHome />);
    expect(screen.getByText('add milk to groceries')).toBeInTheDocument();
    expect(screen.getByText('Done! Added milk.')).toBeInTheDocument();
    expect(screen.getByText('create_grocery_item')).toBeInTheDocument();
    expect(screen.getByText('read_todo')).toBeInTheDocument();
    expect(screen.getByTestId('chat-pending')).toBeInTheDocument();
  });
});
