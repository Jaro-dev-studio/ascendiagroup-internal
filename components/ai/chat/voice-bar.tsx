"use client";

import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceStatus } from "@/hooks/use-voice-session";

interface VoiceBarProps {
  status: VoiceStatus;
  isMuted: boolean;
  isUserSpeaking: boolean;
  isAssistantSpeaking: boolean;
  activeToolLabels: string[];
  error: string | null;
  onToggleMute: () => void;
  onEnd: () => void;
}

function statusLabel({
  status,
  isMuted,
  isUserSpeaking,
  isAssistantSpeaking,
  activeToolLabels,
}: Pick<
  VoiceBarProps,
  "status" | "isMuted" | "isUserSpeaking" | "isAssistantSpeaking" | "activeToolLabels"
>): string {
  if (status === "connecting") return "Connecting...";
  if (activeToolLabels.length > 0) return activeToolLabels.join(", ");
  if (isMuted) return "Muted";
  if (isAssistantSpeaking) return "Speaking";
  if (isUserSpeaking) return "Hearing you";
  return "Listening";
}

export function VoiceBar({
  status,
  isMuted,
  isUserSpeaking,
  isAssistantSpeaking,
  activeToolLabels,
  error,
  onToggleMute,
  onEnd,
}: VoiceBarProps) {
  const isBusy = status === "connecting" || activeToolLabels.length > 0;
  const isActive = !isMuted && (isUserSpeaking || isAssistantSpeaking);

  return (
    <div className="animate-fade-in border-t border-primary-200 bg-primary-50 px-4 py-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="relative flex size-8 shrink-0 items-center justify-center">
              {isActive && (
                <span
                  className="absolute inset-0 animate-pulse rounded-full bg-primary-200"
                  aria-hidden="true"
                />
              )}
              <span className="relative flex size-8 items-center justify-center rounded-full bg-primary-500 text-white">
                {isBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isMuted ? (
                  <MicOff className="size-4" />
                ) : (
                  <Mic className="size-4" />
                )}
              </span>
            </span>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900">
                Voice mode ·{" "}
                <span className="font-normal text-neutral-600">
                  {statusLabel({
                    status,
                    isMuted,
                    isUserSpeaking,
                    isAssistantSpeaking,
                    activeToolLabels,
                  })}
                </span>
              </p>
              <p className="truncate text-[11px] text-neutral-500">
                Talk normally, or type below. Changes still wait for your approval.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              disabled={status !== "live"}
              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
              aria-pressed={isMuted}
              className={cn(
                "flex size-9 items-center justify-center rounded-md border transition-colors disabled:opacity-50",
                isMuted
                  ? "border-neutral-300 bg-neutral-900 text-white hover:bg-neutral-700"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
              )}
            >
              {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </button>

            <button
              type="button"
              onClick={onEnd}
              aria-label="End voice mode"
              className="flex items-center gap-2 rounded-md bg-danger-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-danger-600"
            >
              <PhoneOff className="size-4" />
              End
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-danger-600">{error}</p>}
      </div>
    </div>
  );
}
