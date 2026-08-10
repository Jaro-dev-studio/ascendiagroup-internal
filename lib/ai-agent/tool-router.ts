import OpenAI from "openai";
import type { UserRole } from "@prisma/client";
import { getAllToolGroups, getGroupToolCounts } from "@/lib/ai-tools/registry";
import type { ToolGroup } from "@/lib/ai-tools/types";

const MODEL = "gpt-5-mini";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * The full registry no longer fits in one request, so each turn carries only the
 * groups that could plausibly be relevant. Descriptions are written for the
 * router model, not for humans.
 */
const GROUP_DESCRIPTIONS: Record<ToolGroup, string> = {
  core: "Always included: client company lookup, user lookup, knowledge base search, web search.",
  crm:
    "CRM contacts (people), accounts (companies), deals, pipeline stages, CRM notes and the activity timeline. Engagement signals such as last email or meeting and connection strength.",
  sequences:
    "Outbound email sequences, their steps, enrollments, suppression list, manual send runs and reply syncing.",
  meetings:
    "The upcoming meeting schedule synced from Google Calendar (upcoming or scheduled calls, today's or this week's agenda), recorded calls and transcripts, meeting analysis, meeting followups and followup templates, and calendar recording rules.",
  delivery:
    "Development tasks, action items, feature and bug requests, recurring task schedules and internal workflow maps.",
  clients:
    "Creating, updating and deleting client companies, plus Slack notification settings and test messages.",
  marketing:
    "Marketing form submission leads, Meta Ads funnel metrics, the ad generator, case studies, offers and presentations.",
  sales:
    "Sales call maps, MVP call maps, shared quotes, demos and product builds including queued builds and approvals.",
  gov: "SAM.gov government contract pipeline, contacts, documents, opportunities and market research syncs.",
  knowledge: "Creating, deleting and retrying knowledge base documents.",
  admin:
    "User accounts and roles, password resets, and dashboard page access for roles and individual users.",
};

interface SelectToolGroupsOptions {
  message: string;
  /** Most recent messages, oldest first, used only for context. */
  recentMessages?: Array<{ role: string; content: string }>;
  role: UserRole;
}

function buildCatalog(role: UserRole): string {
  const counts = getGroupToolCounts(role);

  return getAllToolGroups()
    .filter((group) => group !== "core" && counts[group] > 0)
    .map((group) => `- ${group}: ${GROUP_DESCRIPTIONS[group]}`)
    .join("\n");
}

function parseGroups(raw: string): ToolGroup[] {
  const valid = new Set(getAllToolGroups());

  try {
    const parsed = JSON.parse(raw) as { groups?: unknown };
    if (!Array.isArray(parsed.groups)) return [];

    return parsed.groups.filter(
      (group): group is ToolGroup => typeof group === "string" && valid.has(group as ToolGroup)
    );
  } catch {
    return [];
  }
}

/**
 * Picks the tool groups to expose for a turn. Errors and empty results fall back
 * to every group, which leaves the registry's own shedding in charge.
 */
export async function selectToolGroups(
  options: SelectToolGroupsOptions
): Promise<ToolGroup[]> {
  const allGroups = getAllToolGroups();

  console.log("[ToolRouter] selecting tool groups for message...");

  try {
    const context = (options.recentMessages ?? [])
      .slice(-4)
      .map((entry) => `${entry.role}: ${entry.content.slice(0, 500)}`)
      .join("\n");

    const response = await getOpenAI().chat.completions.create({
      model: MODEL,
      reasoning_effort: "low",
      max_completion_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You route a request to the tool groups an assistant may need to answer it.

Groups:
${buildCatalog(options.role)}

Return JSON: {"groups": ["crm", "delivery"]}

Rules:
- Be generous. Include every group that could plausibly be needed, including for follow-up questions in the same conversation. Leaving out a needed group makes the request unanswerable, while including a spare one costs almost nothing.
- Only leave out groups that are clearly unrelated to the conversation.
- If the request is vague, greeting-like or you cannot tell, return every group.`,
        },
        {
          role: "user",
          content: context
            ? `Recent conversation:\n${context}\n\nNew message: ${options.message}`
            : `New message: ${options.message}`,
        },
      ],
    });

    const groups = parseGroups(response.choices[0]?.message?.content ?? "");

    if (groups.length === 0) {
      console.log("[ToolRouter] no groups returned, falling back to all groups");
      return allGroups;
    }

    const selected = groups.includes("core") ? groups : ["core" as ToolGroup, ...groups];
    console.log(`[ToolRouter] selected groups: ${selected.join(", ")}`);

    return selected;
  } catch (error) {
    console.error("[ToolRouter] failed to select tool groups:", error);
    return allGroups;
  }
}
