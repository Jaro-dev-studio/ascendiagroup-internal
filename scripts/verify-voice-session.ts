import Module from "node:module";

/**
 * Mints a real realtime session with the live tool registry and then opens the
 * session over WebSocket to prove the model can call one of those tools and speak
 * the result. Catches a tool schema the realtime API rejects, or a missing key,
 * before anyone opens the panel and taps the microphone.
 *
 * Usage: pnpm voice:verify
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
const PROBE_TOOL = "queryClients";

function record(name: string, ok: boolean, detail: string): boolean {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${detail}`);
  return ok;
}

async function main(): Promise<void> {
  const results: boolean[] = [];

  const {
    buildVoiceInstructions,
    createVoiceSession,
    getRealtimeTools,
    REALTIME_CALLS_URL,
    REALTIME_MODEL,
  } = await import("../lib/ai-agent/realtime");

  const tools = getRealtimeTools(ROLE);
  const instructions = buildVoiceInstructions(ROLE);

  results.push(
    record(
      "Tool registry converts to realtime shape",
      tools.length > 0 && tools.every((tool) => tool.type === "function" && Boolean(tool.name)),
      `${tools.length} tools, ${Math.round(JSON.stringify(tools).length / 1024)}KB of schema`
    )
  );

  results.push(
    record(
      `Registry exposes ${PROBE_TOOL}`,
      tools.some((tool) => tool.name === PROBE_TOOL),
      PROBE_TOOL
    )
  );

  console.log(`\n[Verify] POST client_secrets for ${REALTIME_MODEL}`);

  const credentials = await createVoiceSession({ instructions, tools });

  results.push(
    record(
      "Ephemeral client secret",
      credentials.token.startsWith("ek_"),
      `${credentials.token.slice(0, 6)}..., expires in ${
        credentials.expiresAt - Math.floor(Date.now() / 1000)
      }s`
    )
  );

  results.push(
    record("WebRTC offer endpoint", REALTIME_CALLS_URL.startsWith("https://"), REALTIME_CALLS_URL)
  );

  console.log("\n[Verify] opening the minted session to exercise a tool call...");
  results.push(await exerciseToolCall(credentials.token, credentials.model));

  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed > 0 ? 1 : 0);
}

/** Drives one text turn so a bad tool schema surfaces as a real API error. */
function exerciseToolCall(token: string, model: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new WebSocket(`wss://api.openai.com/v1/realtime?model=${model}`, [
      "realtime",
      `openai-insecure-api-key.${token}`,
    ]);

    let calledTool: string | null = null;
    let spoken = "";

    const finish = (ok: boolean, detail: string) => {
      clearTimeout(timer);
      socket.close();
      resolve(record("Realtime tool call round trip", ok, detail));
    };

    const timer = setTimeout(
      () => finish(false, "timed out waiting for the model to answer"),
      60_000
    );

    const send = (event: Record<string, unknown>) => socket.send(JSON.stringify(event));

    socket.addEventListener("open", () => {
      // Text output keeps the probe cheap; the session config itself is untouched.
      send({ type: "session.update", session: { type: "realtime", output_modalities: ["text"] } });
      send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "How many client companies do we have? Check the data." },
          ],
        },
      });
      send({ type: "response.create" });
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));

      if (message.type === "error") {
        finish(false, message.error?.message ?? "realtime returned an error");
        return;
      }

      if (message.type === "response.output_text.delta") spoken += message.delta ?? "";

      if (message.type === "response.function_call_arguments.done") {
        calledTool = message.name;
        send({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: message.call_id,
            output: JSON.stringify({ total: 9, note: "verification fixture, not real data" }),
          },
        });
        send({ type: "response.create" });
        return;
      }

      if (message.type === "response.done") {
        const usedTool = (message.response?.output ?? []).some(
          (item: { type?: string }) => item.type === "function_call"
        );
        if (usedTool) return;

        if (!calledTool) {
          finish(false, "the model answered without calling a tool");
          return;
        }

        finish(true, `called ${calledTool}, then said "${spoken.trim().slice(0, 120)}"`);
      }
    });

    socket.addEventListener("error", () => finish(false, "websocket error"));
  });
}

main().catch((error) => {
  console.error("[Verify] voice session verification failed:", error);
  process.exit(1);
});
