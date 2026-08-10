"use client";

import { useState } from "react";
import { ChevronDown, CircleAlert, CircleCheck, CircleSlash, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutedToolCall } from "./types";

interface ToolCallListProps {
  toolCalls: ExecutedToolCall[];
}

function formatPayload(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ToolCallList({ toolCalls }: ToolCallListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (toolCalls.length === 0) return null;

  const declined = toolCalls.filter((call) => call.rejected).length;
  const failures = toolCalls.filter((call) => !call.ok && !call.rejected).length;

  return (
    <div className="mb-3 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-600"
        aria-expanded={isOpen}
      >
        <Wrench className="size-3.5 text-neutral-400" />
        <span className="font-medium">
          Ran {toolCalls.length} {toolCalls.length === 1 ? "tool" : "tools"}
        </span>
        {declined > 0 && <span className="text-neutral-500">· {declined} declined</span>}
        {failures > 0 && <span className="text-danger-600">· {failures} failed</span>}
        <ChevronDown
          className={cn(
            "ml-auto size-3.5 text-neutral-400 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <ul className="flex flex-col border-t border-neutral-200">
          {toolCalls.map((call, index) => (
            <li key={`${call.name}-${index}`} className="border-b border-neutral-200 last:border-b-0">
              <button
                type="button"
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
              >
                {call.rejected ? (
                  <CircleSlash className="size-3.5 shrink-0 text-neutral-400" />
                ) : call.ok ? (
                  <CircleCheck className="size-3.5 shrink-0 text-success-600" />
                ) : (
                  <CircleAlert className="size-3.5 shrink-0 text-danger-600" />
                )}
                <span className="truncate font-medium text-neutral-700">{call.label}</span>
                {call.risk !== "read" && (
                  <span className="rounded-sm bg-neutral-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-600">
                    {call.risk}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "ml-auto size-3.5 shrink-0 text-neutral-400 transition-transform",
                    expandedIndex === index && "rotate-180"
                  )}
                />
              </button>

              {expandedIndex === index && (
                <div className="flex flex-col gap-2 bg-white px-3 pb-3 pt-1">
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                      Arguments
                    </p>
                    <pre className="max-h-40 overflow-auto rounded-sm bg-neutral-50 p-2 font-mono text-[11px] text-neutral-700">
                      {formatPayload(call.args)}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                      Result
                    </p>
                    <pre className="max-h-60 overflow-auto rounded-sm bg-neutral-50 p-2 font-mono text-[11px] text-neutral-700">
                      {formatPayload(call.result)}
                    </pre>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
