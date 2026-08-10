"use client";

import { memo } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const LINK_CLASS = "text-primary-600 underline underline-offset-2";

function MarkdownRendererComponent({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("text-sm leading-relaxed text-foreground", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          h1: ({ children }) => (
            <h1 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-3 text-sm font-semibold first:mt-0">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 flex list-disc flex-col gap-1 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 flex list-decimal flex-col gap-1 pl-5 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="marker:text-neutral-400">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-neutral-300 pl-3 text-neutral-600">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => {
            // Links to our own dashboard should navigate in place, not spawn tabs
            const isInternal = href?.startsWith("/") ?? false;

            if (isInternal) {
              return (
                <Link href={href as string} className={LINK_CLASS}>
                  {children}
                </Link>
              );
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_CLASS}
              >
                {children}
              </a>
            );
          },
          hr: () => <hr className="my-4 border-neutral-200" />,
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto rounded-md border border-neutral-200">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-neutral-100">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-neutral-200 px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-neutral-100 px-3 py-2 align-top">{children}</td>
          ),
          code: ({ className: codeClassName, children }) => {
            const match = /language-(\w+)/.exec(codeClassName ?? "");
            const text = String(children).replace(/\n$/, "");

            if (!match && !text.includes("\n")) {
              return (
                <code className="rounded-sm bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-800">
                  {text}
                </code>
              );
            }

            return <CodeBlock language={match?.[1] ?? ""} code={text} />;
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownRenderer = memo(MarkdownRendererComponent);
