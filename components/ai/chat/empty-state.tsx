"use client";

import { Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "What's overdue across all clients right now?",
  "Summarise this week's calls and what we owe each client",
  "Create a high priority task for the login bug on Acme",
  "Research Acme on the web and tell me what they've shipped lately",
];

interface EmptyStateProps {
  onSelect: (prompt: string) => void;
}

export function EmptyState({ onSelect }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-10">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary-500">
        <Sparkles className="size-6 text-white" />
      </div>

      <h2 className="text-lg font-semibold text-neutral-900">How can I help?</h2>
      <p className="mt-1 max-w-md text-center text-sm text-neutral-500">
        Ask about clients, tasks, calls or pipeline, or send me to the web to research
        something. I can make changes too — you approve anything that writes to the system
        before it runs.
      </p>

      <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSelect(suggestion)}
            className="rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
