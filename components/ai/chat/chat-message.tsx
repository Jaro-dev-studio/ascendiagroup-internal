"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Check, Copy, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolCallList } from "./tool-call-list";
import { SourceList } from "./source-list";
import { ConfirmationCard } from "./confirmation-card";
import type { ChatMessage as ChatMessageType } from "./types";

interface ChatMessageProps {
  message: ChatMessageType;
  isLastAssistant: boolean;
  isBusy: boolean;
  onResolveActions: (decisions: Array<{ pendingActionId: string; approved: boolean }>) => void;
  onRegenerate: () => void;
}

export function ChatMessage({
  message,
  isLastAssistant,
  isBusy,
  onResolveActions,
  onRegenerate,
}: ChatMessageProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});

  const openActions = useMemo(
    () => (message.pendingActions ?? []).filter((action) => action.status === "PENDING"),
    [message.pendingActions]
  );

  const resolveRef = useRef(onResolveActions);
  resolveRef.current = onResolveActions;

  // The batch is submitted as one request, so wait until every card is decided.
  useEffect(() => {
    if (openActions.length === 0) return;

    const allDecided = openActions.every((action) => action.id in decisions);
    if (!allDecided) return;

    resolveRef.current(
      openActions.map((action) => ({
        pendingActionId: action.id,
        approved: decisions[action.id],
      }))
    );
    setDecisions({});
  }, [decisions, openActions]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className={cn(
            "flex max-w-[85%] items-start gap-2 rounded-lg px-4 py-2.5",
            message.isDraft ? "bg-neutral-50 ring-1 ring-neutral-200" : "bg-neutral-100"
          )}
        >
          {message.isDraft && (
            <AudioLines
              className="mt-0.5 size-3.5 shrink-0 text-neutral-400"
              aria-label="Transcribing speech"
            />
          )}

          <p className="whitespace-pre-wrap text-sm text-neutral-900">
            {message.content}
            {message.isDraft && (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-caret-blink bg-neutral-500 align-middle" />
            )}
          </p>
        </div>
      </div>
    );
  }

  const toolCalls = message.toolCalls ?? [];
  const pendingActions = message.pendingActions ?? [];

  return (
    <div className="group flex gap-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-500">
        {message.isDraft ? (
          <AudioLines className="size-3.5 text-white" />
        ) : (
          <Sparkles className="size-3.5 text-white" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {toolCalls.length > 0 && <ToolCallList toolCalls={toolCalls} />}

        {message.content && (
          <>
            <MarkdownRenderer content={message.content} />
            {message.isDraft && (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-caret-blink bg-neutral-900 align-middle" />
            )}
          </>
        )}

        {toolCalls.length > 0 && <SourceList toolCalls={toolCalls} />}

        {pendingActions.length > 0 && (
          <div className="mt-3">
            {pendingActions.map((action) => (
              <ConfirmationCard
                key={action.id}
                action={action}
                isBusy={isBusy || action.id in decisions}
                onDecide={(actionId, approved) =>
                  setDecisions((prev) => ({ ...prev, [actionId]: approved }))
                }
              />
            ))}
          </div>
        )}

        {message.content && !message.isDraft && (
          <div
            className={cn(
              "mt-2 flex items-center gap-1 opacity-0 transition-opacity",
              "group-hover:opacity-100 focus-within:opacity-100"
            )}
          >
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-xs text-neutral-400 transition-colors hover:text-neutral-700"
              aria-label="Copy response"
            >
              {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </button>

            {isLastAssistant && !isBusy && (
              <button
                type="button"
                onClick={onRegenerate}
                className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-xs text-neutral-400 transition-colors hover:text-neutral-700"
                aria-label="Retry this answer"
              >
                <RefreshCw className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
