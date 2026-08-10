"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, AudioLines, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  isStreaming: boolean;
  isVoiceLive: boolean;
  isVoiceConnecting: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
  onStartVoice: () => void;
}

export function ChatComposer({
  isStreaming,
  isVoiceLive,
  isVoiceConnecting,
  onSend,
  onStop,
  onStartVoice,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-neutral-200 bg-white px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-lg border border-neutral-200 bg-white p-2 focus-within:border-primary-400">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              isVoiceLive
                ? "Talk, or type to send into the call..."
                : "Ask anything, or describe a change to make..."
            }
            aria-label="Message the assistant"
            className="max-h-[200px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
          />

          {!isVoiceLive && (
            <button
              type="button"
              onClick={onStartVoice}
              disabled={isVoiceConnecting || isStreaming}
              aria-label="Start voice mode"
              title="Start voice mode"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
            >
              <AudioLines className="size-4" />
            </button>
          )}

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="flex size-8 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-white transition-colors hover:bg-neutral-700"
            >
              <Square className="size-3.5 fill-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!value.trim()}
              aria-label="Send message"
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors",
                value.trim()
                  ? "bg-primary-500 text-white hover:bg-primary-600"
                  : "bg-neutral-200 text-neutral-400"
              )}
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>

        <p className="mt-2 text-center text-[11px] text-neutral-400">
          Changes to data always wait for your approval.
        </p>
      </div>
    </div>
  );
}
