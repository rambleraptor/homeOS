/**
 * Ephemeral chat state. The transcript lives in component state only —
 * a reload starts a fresh conversation (no aepbase persistence).
 */

import { useCallback, useState } from 'react';
import { ChatNotConfiguredError, sendChat } from '../api';
import type { ChatMessage, ChatToolCall } from '../types';

export interface UiChatMessage extends ChatMessage {
  /** Tool activity behind an assistant reply, for display. */
  toolCalls?: ChatToolCall[];
}

export function useChat() {
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || pending) return;

      const userMessage: UiChatMessage = { role: 'user', content };
      const transcript = [...messages, userMessage];
      setMessages(transcript);
      setPending(true);
      setError(null);

      try {
        // Server only needs role/content; toolCalls are display-only.
        const response = await sendChat(
          transcript.map(({ role, content: c }) => ({ role, content: c })),
        );
        setMessages([
          ...transcript,
          {
            role: 'assistant',
            content: response.reply,
            toolCalls: response.toolCalls,
          },
        ]);
      } catch (err) {
        // Keep the transcript (including the unanswered user message) so
        // the user can see what failed and retry.
        if (err instanceof ChatNotConfiguredError) {
          setNotConfigured(true);
        } else {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        }
      } finally {
        setPending(false);
      }
    },
    [messages, pending],
  );

  return { messages, pending, error, notConfigured, send };
}
