import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { getIntegrationCredentials } from "./store";

const DEFAULT_MODEL = "claude-sonnet-4-5";

export class ClaudeNotConnectedError extends Error {
  constructor() {
    super(
      "Claude is not connected. Add an Anthropic API key in Settings > Integrations to enable AI features."
    );
    this.name = "ClaudeNotConnectedError";
  }
}

export async function getClaudeClient() {
  const credentials = await getIntegrationCredentials("CLAUDE");
  if (!credentials?.apiKey) throw new ClaudeNotConnectedError();

  return {
    client: new Anthropic({ apiKey: credentials.apiKey }),
    model: credentials.model?.trim() || DEFAULT_MODEL,
  };
}

interface CompleteOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
  history?: { role: "user" | "assistant"; content: string }[];
}

export async function completeWithClaude({
  system,
  prompt,
  maxTokens = 4000,
  history = [],
}: CompleteOptions): Promise<{ text: string; model: string }> {
  const { client, model } = await getClaudeClient();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [...history, { role: "user" as const, content: prompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return { text, model };
}

/** Claude reliably wraps JSON in prose or fences, so pull the outer object out. */
export function parseJsonFromClaude<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Claude did not return a JSON object");
  }

  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
