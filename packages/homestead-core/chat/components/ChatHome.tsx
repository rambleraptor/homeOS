import { useEffect, useRef, useState } from 'react';
import { Check, MessageCircle, Send, Wrench, X } from 'lucide-react';
import { Card } from '@rambleraptor/homestead-core/shared/components/Card';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { useChat, type UiChatMessage } from '../hooks/useChat';
import type { ChatToolCall } from '../types';

function ToolCallChip({ call }: { call: ChatToolCall }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        call.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
      }`}
      title={call.ok ? undefined : call.error}
    >
      <Wrench className="w-3 h-3" aria-hidden="true" />
      {call.tool}
      {call.ok ? (
        <Check className="w-3 h-3" aria-hidden="true" />
      ) : (
        <X className="w-3 h-3" aria-hidden="true" />
      )}
    </span>
  );
}

/** Animated three-dot "assistant is typing" indicator. */
function TypingIndicator() {
  return (
    <div className="flex justify-start" data-testid="chat-pending">
      <div className="bg-bg-pearl rounded-2xl px-4 py-3">
        <div className="flex items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: UiChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isUser
            ? 'bg-accent-terracotta text-white'
            : 'bg-bg-pearl text-gray-900'
        }`}
      >
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {message.toolCalls.map((call, i) => (
              <ToolCallChip key={i} call={call} />
            ))}
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        {message.toolCalls?.some((c) => !c.ok) && (
          <div className="mt-2 space-y-1">
            {message.toolCalls
              .filter((c) => !c.ok)
              .map((call, i) => (
                <p key={i} className="text-xs text-red-600">
                  {call.tool}: {call.error}
                </p>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatHome() {
  const { messages, pending, error, notConfigured, send } = useChat();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || pending) return;
    void send(draft);
    setDraft('');
  };

  if (notConfigured) {
    return (
      <div className="space-y-6">
        <PageHeader title="Chat" subtitle="Your household assistant" />
        <Card>
          <div className="text-center py-12">
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Chat isn't configured</p>
            <p className="text-sm text-gray-500 mt-2">
              Set GEMINI_API_KEY on the server to enable the assistant.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
      <PageHeader
        title="Chat"
        subtitle="Ask the assistant to look up or change your household data"
      />

      {/* Card's inner CardContent isn't a flex container, so the chat
          column uses a plain styled div to let the message list stretch. */}
      <div className="flex-1 flex flex-col min-h-0 bg-surface-white border border-gray-100 rounded-xl shadow-sm p-4">
        <div
          className="flex-1 overflow-y-auto space-y-3 p-1"
          data-testid="chat-messages"
        >
          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Start a conversation</p>
              <p className="text-sm text-gray-500 mt-2">
                Try "What's on my todo list?" or "Add milk to the grocery
                list"
              </p>
            </div>
          )}
          {messages.map((message, i) => (
            <MessageBubble key={i} message={message} />
          ))}
          {pending && <TypingIndicator />}
          {error && (
            <p
              className="text-sm text-red-600 whitespace-pre-wrap break-words rounded-lg bg-red-50 px-3 py-2"
              role="alert"
            >
              {error}
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message the assistant…"
            disabled={pending}
            data-testid="chat-input"
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-terracotta/50 disabled:bg-bg-pearl"
          />
          <Button
            type="submit"
            disabled={pending || !draft.trim()}
            data-testid="chat-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
