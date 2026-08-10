"use client";

import { Sparkles } from "lucide-react";

interface ChatLauncherProps {
  onClick: () => void;
}

export function ChatLauncher({ onClick }: ChatLauncherProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open AI assistant"
      title="AI assistant (⌘L)"
      className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-colors hover:bg-primary-600"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <Sparkles className="size-6" />
    </button>
  );
}
