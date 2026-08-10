"use client";

import { useEffect, useRef } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";
import { ChatMessage } from "./chat-message";
import { EmptyState } from "./empty-state";
import type { ChatMessage as ChatMessageType } from "./types";

interface MessageListProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  statusMessage: string | null;
  activeTools: string[];
  onSend: (message: string) => void;
  onResolveActions: (decisions: Array<{ pendingActionId: string; approved: boolean }>) => void;
  onRegenerate: () => void;
}

export function MessageList({
  messages,
  isLoading,
  isStreaming,
  streamingContent,
  statusMessage,
  activeTools,
  onSend,
  onResolveActions,
  onRegenerate,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPinnedRef = useRef(true);

  // Streaming updates fire every token, and repeatedly restarting a smooth scroll
  // never lets it land, so the container is scrolled directly instead.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !isPinnedRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, streamingContent, statusMessage, isLoading]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isPinnedRef.current = distanceFromBottom < 80;
  };

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (messages.length === 0 && !isStreaming) {
    return <EmptyState onSelect={onSend} />;
  }

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            isLastAssistant={message.id === lastAssistantId}
            isBusy={isStreaming}
            onResolveActions={onResolveActions}
            onRegenerate={onRegenerate}
          />
        ))}

        {isStreaming && (
          <div className="flex gap-3">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-500">
              <Sparkles className="size-3.5 text-white" />
            </div>

            <div className="min-w-0 flex-1">
              {(statusMessage || activeTools.length > 0) && !streamingContent && (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>{activeTools.length > 0 ? activeTools.join(", ") : statusMessage}</span>
                </div>
              )}

              {streamingContent && (
                <>
                  <MarkdownRenderer content={streamingContent} />
                  <span className="ml-0.5 inline-block h-4 w-[2px] animate-caret-blink bg-neutral-900 align-middle" />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
