"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Check, Copy } from "lucide-react";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const SyntaxHighlighter = dynamic(
  () => import("react-syntax-highlighter").then((module) => module.Prism),
  {
    ssr: false,
    loading: () => (
      <div className="px-4 py-3 font-mono text-xs text-neutral-400">Loading…</div>
    ),
  }
);

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="my-3 overflow-hidden rounded-md border border-neutral-800">
      <div className="flex items-center justify-between bg-neutral-900 px-3 py-1.5">
        <span className="font-mono text-xs text-neutral-400">{language || "text"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-neutral-400 transition-colors hover:text-white"
          aria-label="Copy code"
        >
          {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {isCopied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "0.875rem",
          fontSize: "0.8125rem",
          background: "#171717",
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
