import OpenAI from "openai";

/**
 * Web search runs as a nested OpenAI Responses call using the hosted web search
 * tool: OpenAI picks the queries, reads the pages and returns a short answer
 * plus the pages it cited. That keeps the feature on the key the rest of the
 * assistant already uses instead of adding a separate search provider.
 */

const MODEL = process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-5-mini";

/**
 * The chat route only has 60s for the whole turn, and a search is one step
 * inside it, so a slow search is cut short rather than losing the whole answer.
 * Callers with a longer budget, such as the company research agent, raise it.
 */
const REQUEST_TIMEOUT_MS = 40_000;

const MAX_SOURCES = 10;

/** OpenAI appends this to every citation; it is noise in the chat transcript. */
const CITATION_TRACKING_PARAM = "utm_source";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * `quick` is the default because the caller is an agent mid-turn; `thorough`
 * reads more of each page and reasons harder, at roughly double the latency.
 */
export type SearchDepth = "quick" | "thorough";

export interface WebSource {
  title: string;
  url: string;
}

export interface WebSearchResult {
  answer: string;
  sources: WebSource[];
  /** The queries OpenAI actually ran, surfaced so the answer can be judged. */
  queries: string[];
}

const INSTRUCTIONS = `You are a research assistant. Search the web and answer the question from what you find.

- Lead with the answer, then the few facts that support it. Six sentences at most.
- Attach dates to anything that changes over time, and say when a source is out of date or the sources disagree.
- Report what the sources say, even when it contradicts what you expected. If the web does not answer the question, say so plainly instead of filling the gap from memory.`;

/** `action` carries the queries that ran but is missing from the SDK's types. */
interface WebSearchCallItem {
  type: string;
  action?: { query?: string; queries?: string[] };
}

function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete(CITATION_TRACKING_PARAM);
    return parsed.toString();
  } catch {
    return url;
  }
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Citations repeat once per sentence they support, so the list is deduplicated. */
function collectSources(response: OpenAI.Responses.Response): WebSource[] {
  const byUrl = new Map<string, WebSource>();

  for (const item of response.output) {
    if (item.type !== "message") continue;

    for (const part of item.content) {
      if (part.type !== "output_text") continue;

      for (const annotation of part.annotations) {
        if (annotation.type !== "url_citation") continue;

        const url = cleanUrl(annotation.url);
        if (byUrl.has(url)) continue;

        byUrl.set(url, { title: annotation.title?.trim() || hostname(url), url });
      }
    }
  }

  return Array.from(byUrl.values()).slice(0, MAX_SOURCES);
}

function collectQueries(response: OpenAI.Responses.Response): string[] {
  const queries = new Set<string>();

  for (const item of response.output as unknown as WebSearchCallItem[]) {
    if (item.type !== "web_search_call") continue;

    for (const query of item.action?.queries ?? []) queries.add(query);
    if (item.action?.query) queries.add(item.action.query);
  }

  return Array.from(queries);
}

export async function searchWeb(options: {
  query: string;
  depth?: SearchDepth;
  /** Overrides the default budget for callers that are not mid-conversation. */
  timeoutMs?: number;
  /**
   * The SDK retries twice by default, so a timed-out search costs three times
   * its budget. Callers on a fixed clock set this to 0.
   */
  maxRetries?: number;
}): Promise<WebSearchResult> {
  const { query, depth = "quick", timeoutMs = REQUEST_TIMEOUT_MS, maxRetries } = options;

  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

  console.log(`[WebSearch] searching the web for "${query.slice(0, 120)}" (${depth})...`);

  const response = await getOpenAI().responses.create(
    {
      model: MODEL,
      instructions: `${INSTRUCTIONS}\n\nToday's date is ${new Date().toISOString().split("T")[0]}.`,
      input: query,
      tools: [
        {
          type: "web_search_preview",
          search_context_size: depth === "thorough" ? "high" : "medium",
        },
      ],
      // Forced, because the caller already decided the web is needed. Left on
      // auto the model answers small talk from memory and reports it as research.
      tool_choice: { type: "web_search_preview" },
      reasoning: { effort: depth === "thorough" ? "medium" : "low" },
    },
    { timeout: timeoutMs, ...(maxRetries === undefined ? {} : { maxRetries }) }
  );

  const sources = collectSources(response);
  const queries = collectQueries(response);

  console.log(
    `[WebSearch] ran ${queries.length} ${queries.length === 1 ? "query" : "queries"}, cited ${sources.length} ${sources.length === 1 ? "source" : "sources"}`
  );

  return { answer: response.output_text.trim(), sources, queries };
}
