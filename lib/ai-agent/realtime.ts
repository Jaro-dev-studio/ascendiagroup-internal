import type OpenAI from "openai";
import type { UserRole } from "@prisma/client";
import { getAllToolDefinitions } from "@/lib/ai-tools/registry";
import { buildSystemPrompt } from "./system-prompt";

const CLIENT_SECRET_URL = "https://api.openai.com/v1/realtime/client_secrets";

/** The browser posts its WebRTC offer here with the ephemeral token. */
export const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";

const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || "marin";
const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

/** Pinning the language stops the transcriber inventing words out of room noise. */
const TRANSCRIPTION_LANGUAGE = process.env.OPENAI_REALTIME_LANGUAGE || "en";

const SESSION_TTL_SECONDS = 600;

export interface RealtimeTool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Chat Completions nests the schema under `function`; Realtime keeps it flat. */
export function toRealtimeTools(
  tools: OpenAI.Chat.Completions.ChatCompletionTool[]
): RealtimeTool[] {
  return tools.flatMap((tool) => {
    if (tool.type !== "function") return [];

    return [
      {
        type: "function" as const,
        name: tool.function.name,
        description: tool.function.description ?? tool.function.name,
        parameters: (tool.function.parameters as Record<string, unknown>) ?? {
          type: "object",
          properties: {},
        },
      },
    ];
  });
}

/**
 * A call wanders across topics with no chance to re-route between turns, so the
 * session carries every tool the role may use. Realtime has no 128 tool ceiling
 * to work around, and the definitions are cached input after the first response.
 */
export function getRealtimeTools(role: UserRole): RealtimeTool[] {
  return toRealtimeTools(getAllToolDefinitions(role));
}

const VOICE_ADDENDUM = `

You are on a live voice call with the user right now. Everything you say is spoken out loud, and a text transcript of the call appears in the chat as you talk.

How to speak:
- Talk like a colleague on the phone: plain sentences, contractions, no filler.
- Never use markdown. No bullet points, headings, tables, code blocks or asterisks.
- Keep it to a couple of sentences. Give the headline number or answer first, then offer to go deeper instead of reading everything out.
- If the answer is a long list, say how many there are and name the first few.
- Say numbers, money and dates the way a person would, and skip IDs, URLs and raw JSON unless the user asks for them.

Tools on a call:
- Call tools exactly as you would in the text chat. Stay quiet while a lookup runs, or say a short "one second" first if you expect it to be slow.
- Anything that creates, updates, deletes or sends still needs approval. Calling the tool puts an approval card on the user's screen. Say in one sentence what is waiting there, then stop and let them decide.
- Never say a change has been made until you are told it was approved. If it is rejected, acknowledge it and move on.
- If the user says something like "go ahead" or "approve it", explain that they need to tap approve on the card, because you cannot approve it for them.

The user can also type in the same chat while the call is running. Treat typed messages exactly like spoken ones. If you are interrupted, stop talking and listen.`;

export function buildVoiceInstructions(role: UserRole): string {
  return `${buildSystemPrompt(role)}${VOICE_ADDENDUM}`;
}

export interface VoiceSessionCredentials {
  token: string;
  expiresAt: number;
  model: string;
  callsUrl: string;
}

/**
 * Mints a short lived client secret so the browser can open the WebRTC session
 * without ever seeing the account key. Prompt, voice and tools are fixed here at
 * mint time, which keeps them out of reach of the client.
 */
export async function createVoiceSession(options: {
  instructions: string;
  tools: RealtimeTool[];
}): Promise<VoiceSessionCredentials> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  console.log(`[AIVoice] minting realtime session with ${options.tools.length} tools...`);

  const response = await fetch(CLIENT_SECRET_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: SESSION_TTL_SECONDS },
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions: options.instructions,
        output_modalities: ["audio"],
        audio: {
          input: {
            transcription: {
              model: TRANSCRIPTION_MODEL,
              language: TRANSCRIPTION_LANGUAGE,
            },
            noise_reduction: { type: "near_field" },
            turn_detection: {
              type: "semantic_vad",
              eagerness: "medium",
              create_response: true,
              interrupt_response: true,
            },
          },
          output: { voice: REALTIME_VOICE },
        },
        tools: options.tools,
        tool_choice: "auto",
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { value?: string; expires_at?: number; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.value) {
    const message = payload?.error?.message ?? `OpenAI returned ${response.status}`;
    throw new Error(`Could not start a realtime session: ${message}`);
  }

  console.log("[AIVoice] realtime session minted");

  return {
    token: payload.value,
    expiresAt: payload.expires_at ?? Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    model: REALTIME_MODEL,
    callsUrl: REALTIME_CALLS_URL,
  };
}
