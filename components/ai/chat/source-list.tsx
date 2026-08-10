"use client";

import { useMemo } from "react";
import { Globe } from "lucide-react";
import type { ExecutedToolCall } from "./types";

interface SourceListProps {
  toolCalls: ExecutedToolCall[];
}

interface WebSource {
  title: string;
  url: string;
}

const WEB_SEARCH_TOOL = "searchWeb";

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * The pages a web search read. They live inside the tool result, which is only
 * shown as raw JSON behind the tool disclosure, so they are lifted out here.
 */
function extractSources(toolCalls: ExecutedToolCall[]): WebSource[] {
  const byUrl = new Map<string, WebSource>();

  for (const call of toolCalls) {
    if (call.name !== WEB_SEARCH_TOOL || !call.ok) continue;

    const sources = (call.result as { sources?: unknown } | null)?.sources;
    if (!Array.isArray(sources)) continue;

    for (const source of sources) {
      const { title, url } = (source ?? {}) as Partial<WebSource>;
      if (typeof url !== "string" || !url.startsWith("http") || byUrl.has(url)) continue;

      byUrl.set(url, { title: typeof title === "string" && title ? title : hostname(url), url });
    }
  }

  return Array.from(byUrl.values());
}

export function SourceList({ toolCalls }: SourceListProps) {
  const sources = useMemo(() => extractSources(toolCalls), [toolCalls]);

  if (sources.length === 0) return null;

  return (
    <section className="mt-3" aria-label="Web sources">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
        <Globe className="size-3" aria-hidden="true" />
        {sources.length} {sources.length === 1 ? "source" : "sources"}
      </p>

      <ul className="flex flex-wrap gap-1.5">
        {sources.map((source, index) => {
          const domain = hostname(source.url);

          return (
            <li key={source.url} className="max-w-full">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                title={source.title}
                className="flex max-w-full items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900"
              >
                <span className="text-neutral-400">{index + 1}</span>
                <span className="truncate">{source.title}</span>
                {source.title !== domain && (
                  <span className="shrink-0 text-neutral-400">{domain}</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
