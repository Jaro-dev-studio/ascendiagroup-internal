import Module from "node:module";

/**
 * Runs the real web search tool the way the chat agent runs it, then asks the
 * agent's own model to use it, so a broken tool schema or an unsupported search
 * model shows up here instead of mid-conversation.
 *
 * Usage: pnpm web:verify
 */

// A few tools reach into modules guarded by `server-only`, which only understands
// the Next bundler. Outside it the guard always throws, so it is stubbed here.
const loadModule = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function patched(
  ...args: unknown[]
) {
  if (args[0] === "server-only") return {};
  return loadModule.apply(this, args);
};

const ROLE = "ADMIN" as const;
const TOOL = "searchWeb";
const QUESTION = "What is the latest stable version of Next.js, and when was it released?";

function record(name: string, ok: boolean, detail: string): boolean {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${detail}`);
  return ok;
}

async function main(): Promise<void> {
  const results: boolean[] = [];

  const { searchWeb } = await import("../lib/web-search/search");
  const { executeTool, getTool, getToolsForGroups } = await import("../lib/ai-tools/registry");

  console.log(`[Verify] searching the web for "${QUESTION}"\n`);

  const search = await searchWeb({ query: QUESTION });

  results.push(
    record("Web search returns an answer", search.answer.length > 0, `"${search.answer.slice(0, 160)}..."`)
  );

  results.push(
    record(
      "Web search returns citable sources",
      search.sources.length > 0 && search.sources.every((source) => source.url.startsWith("http")),
      search.sources.map((source) => source.url).join(", ") || "none"
    )
  );

  results.push(
    record(
      "Citations are stripped of tracking params",
      search.sources.every((source) => !source.url.includes("utm_source=openai")),
      `${search.sources.length} source(s) checked`
    )
  );

  results.push(
    record(
      `Registry exposes ${TOOL} in every turn`,
      getToolsForGroups(["crm"], ROLE).some(
        (tool) => tool.type === "function" && tool.function.name === TOOL
      ),
      "present with the core group only"
    )
  );

  const tool = getTool(TOOL);

  results.push(
    record(
      `${TOOL} runs without confirmation`,
      tool?.risk === "read" && tool?.adminOnly === false,
      `risk=${tool?.risk}, adminOnly=${tool?.adminOnly}`
    )
  );

  const execution = await executeTool(
    TOOL,
    { query: "Who is the current CEO of OpenAI?", depth: "quick" },
    { userId: "verify", userEmail: "verify@jaro.dev", role: ROLE, chatId: "verify" }
  );

  const payload = execution.value as { answer?: string; sources?: unknown[] };

  results.push(
    record(
      `${TOOL} executes through the registry`,
      execution.ok && Boolean(payload.answer) && Array.isArray(payload.sources),
      execution.ok ? `"${payload.answer?.slice(0, 120)}..."` : (execution.error ?? "failed")
    )
  );

  results.push(await exerciseAgent());

  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed > 0 ? 1 : 0);
}

/** Proves the chat model reaches for the tool on its own for a live-data question. */
async function exerciseAgent(): Promise<boolean> {
  const OpenAI = (await import("openai")).default;
  const { getToolsForGroups } = await import("../lib/ai-tools/registry");
  const { buildSystemPrompt } = await import("../lib/ai-agent/system-prompt");

  console.log("\n[Verify] asking the chat model a question only the web can answer...");

  const response = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: buildSystemPrompt("ADMIN") },
      { role: "user", content: "What did OpenAI announce this week? Check before you answer." },
    ],
    tools: getToolsForGroups(["core"], "ADMIN"),
    tool_choice: "auto",
  });

  const called = (response.choices[0]?.message?.tool_calls ?? []).map(
    (call) => "function" in call && call.function.name
  );

  return record(
    "Chat model picks the tool on its own",
    called.includes(TOOL),
    called.length > 0 ? called.join(", ") : "the model answered without calling a tool"
  );
}

main().catch((error) => {
  console.error("[Verify] web search verification failed:", error);
  process.exit(1);
});
