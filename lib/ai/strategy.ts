import "server-only";

import type { StrategyPhaseKey, TaskPriority } from "@prisma/client";

import prisma from "@/lib/prisma";
import { completeWithClaude, parseJsonFromClaude } from "@/lib/integrations/claude";

const SYSTEM_PROMPT = `You are the strategy director at a marketing agency that works exclusively with dental and healthcare practices.
You turn onboarding answers and sales call transcripts into a concrete 30/60/90 day delivery roadmap.
You are specific, commercially minded and never invent facts that are not supported by the source material.
When the sources do not cover something, say so explicitly in the risks section instead of guessing.`;

interface GeneratedStrategy {
  title: string;
  summary: string;
  positioning: string;
  audience: string;
  risks: string;
  phases: {
    phase: "DAY_30" | "DAY_60" | "DAY_90";
    title: string;
    objective: string;
    items: {
      title: string;
      description: string;
      category: string;
      priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    }[];
  }[];
}

const PHASE_ORDER: Record<StrategyPhaseKey, number> = {
  DAY_30: 0,
  DAY_60: 1,
  DAY_90: 2,
};

function buildSourceBlock(label: string, body: string) {
  return `<source name="${label}">\n${body.trim()}\n</source>`;
}

export async function generateStrategy(options: {
  clientId: string;
  submissionId?: string | null;
  meetingIds: string[];
  createdById: string;
  extraContext?: string;
}) {
  const client = await prisma.client.findUnique({
    where: { id: options.clientId },
    include: { services: true },
  });
  if (!client) throw new Error("Client not found");

  console.log(`[Strategy] gathering sources for ${client.name}...`);

  const sources: string[] = [];

  sources.push(
    buildSourceBlock(
      "Client profile",
      [
        `Practice: ${client.name}`,
        client.practiceType ? `Practice type: ${client.practiceType}` : "",
        client.website ? `Website: ${client.website}` : "",
        client.city ? `Location: ${[client.city, client.country].filter(Boolean).join(", ")}` : "",
        client.packageTier ? `Package: ${client.packageTier}` : "",
        client.services.length
          ? `Contracted services: ${client.services.map((service) => service.service).join(", ")}`
          : "",
        client.monthlyRetainer ? `Monthly retainer: ${client.monthlyRetainer}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
  );

  if (options.submissionId) {
    const submission = await prisma.onboardingSubmission.findUnique({
      where: { id: options.submissionId },
      include: { answers: { orderBy: { createdAt: "asc" } } },
    });

    if (submission) {
      const body = submission.answers
        .filter((answer) => !answer.isCredential)
        .map((answer) => {
          const value = answer.values.length
            ? answer.values.join(", ")
            : answer.value ?? "";
          return value ? `${answer.section} — ${answer.label}: ${value}` : "";
        })
        .filter(Boolean)
        .join("\n");

      if (body) sources.push(buildSourceBlock("Onboarding form answers", body));
    }
  }

  if (options.meetingIds.length) {
    const meetings = await prisma.meeting.findMany({
      where: { id: { in: options.meetingIds } },
      orderBy: { occurredAt: "asc" },
    });

    for (const meeting of meetings) {
      const body = [meeting.summary, meeting.transcript]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 24_000);
      if (body) {
        sources.push(
          buildSourceBlock(`Call: ${meeting.title} (${meeting.type})`, body)
        );
      }
    }
  }

  if (options.extraContext?.trim()) {
    sources.push(buildSourceBlock("Additional context", options.extraContext));
  }

  if (sources.length <= 1) {
    throw new Error(
      "Add at least one source — an onboarding submission, a call transcript or extra context — before generating a strategy."
    );
  }

  const prompt = `${sources.join("\n\n")}

Using only the sources above, produce a 30/60/90 day marketing roadmap for this practice.

Return raw JSON matching exactly this shape, with no commentary outside the JSON:
{
  "title": string,
  "summary": string,
  "positioning": string,
  "audience": string,
  "risks": string,
  "phases": [
    {
      "phase": "DAY_30" | "DAY_60" | "DAY_90",
      "title": string,
      "objective": string,
      "items": [
        { "title": string, "description": string, "category": string, "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT" }
      ]
    }
  ]
}

Rules:
- Exactly three phases, in the order DAY_30, DAY_60, DAY_90.
- Between 4 and 7 items per phase, each one an action the agency can assign and complete.
- "category" is a short delivery lane such as SEO, Google Ads, Content, Reputation, Website, Tracking.
- Ground every item in the sources; put unknowns and dependencies into "risks".`;

  console.log("[Strategy] asking Claude for the 90 day roadmap...");
  const { text, model } = await completeWithClaude({
    system: SYSTEM_PROMPT,
    prompt,
    maxTokens: 6000,
  });

  const parsed = parseJsonFromClaude<GeneratedStrategy>(text);
  if (!parsed.phases?.length) {
    throw new Error("Claude returned a strategy without any phases");
  }

  console.log(`[Strategy] persisting generated strategy for ${client.name}...`);

  const strategy = await prisma.strategy.create({
    data: {
      clientId: client.id,
      title: parsed.title || `${client.name} — 90 day roadmap`,
      summary: parsed.summary,
      positioning: parsed.positioning,
      audience: parsed.audience,
      risks: parsed.risks,
      model,
      sourceSubmissionId: options.submissionId || null,
      sourceMeetingIds: options.meetingIds,
      generatedAt: new Date(),
      createdById: options.createdById,
      phases: {
        create: parsed.phases.map((phase) => ({
          phase: phase.phase as StrategyPhaseKey,
          title: phase.title,
          objective: phase.objective,
          order: PHASE_ORDER[phase.phase as StrategyPhaseKey] ?? 0,
          items: {
            create: (phase.items ?? []).map((item, index) => ({
              title: item.title,
              description: item.description,
              category: item.category,
              priority: (item.priority ?? "MEDIUM") as TaskPriority,
              order: index,
            })),
          },
        })),
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      clientId: client.id,
      actorId: options.createdById,
      type: "STRATEGY_GENERATED",
      title: "90 day strategy generated",
      description: parsed.title,
      link: `/dashboard/strategies/${strategy.id}`,
    },
  });

  await prisma.knowledgeDocument.create({
    data: {
      clientId: client.id,
      title: `Strategy: ${parsed.title}`,
      source: "STRATEGY",
      sourceRef: strategy.id,
      summary: parsed.summary,
      createdById: options.createdById,
      content: [
        parsed.summary,
        `Positioning: ${parsed.positioning}`,
        `Audience: ${parsed.audience}`,
        `Risks: ${parsed.risks}`,
        ...parsed.phases.map(
          (phase) =>
            `${phase.title} (${phase.phase}) — ${phase.objective}\n` +
            phase.items
              .map((item) => `- ${item.title}: ${item.description}`)
              .join("\n")
        ),
      ].join("\n\n"),
    },
  });

  return strategy;
}
