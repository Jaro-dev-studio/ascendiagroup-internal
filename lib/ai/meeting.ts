import "server-only";

import prisma from "@/lib/prisma";
import { completeWithClaude, parseJsonFromClaude } from "@/lib/integrations/claude";

const SYSTEM_PROMPT = `You summarise client calls for a dental and healthcare marketing agency.
You are concise, factual and only report what was actually said in the transcript.`;

interface GeneratedSummary {
  summary: string;
  nextSteps: string;
  actionItems: { title: string; owner: string }[];
}

export async function summariseMeeting(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { client: true },
  });

  if (!meeting) throw new Error("Meeting not found");
  if (!meeting.transcript?.trim()) {
    throw new Error("Add a transcript before generating a summary");
  }

  console.log(`[Meetings] summarising "${meeting.title}" with Claude...`);

  const prompt = `Client: ${meeting.client.name}
Call type: ${meeting.type}
Date: ${meeting.occurredAt.toISOString().slice(0, 10)}

Transcript:
"""
${meeting.transcript.slice(0, 40_000)}
"""

Return raw JSON with no commentary outside the JSON:
{
  "summary": string,        // 3-6 sentence recap of what was discussed and decided
  "nextSteps": string,      // short paragraph describing what happens next
  "actionItems": [ { "title": string, "owner": string } ]
}

Rules:
- Between 2 and 8 action items, each phrased as a task the agency or the client can complete.
- "owner" is the name or role mentioned in the call, or "Agency" when unclear.`;

  const { text } = await completeWithClaude({
    system: SYSTEM_PROMPT,
    prompt,
    maxTokens: 2500,
  });

  const parsed = parseJsonFromClaude<GeneratedSummary>(text);

  console.log(
    `[Meetings] storing summary and ${parsed.actionItems?.length ?? 0} action items...`
  );

  await prisma.$transaction([
    prisma.meetingActionItem.deleteMany({
      where: { meetingId, taskId: null },
    }),
    prisma.meeting.update({
      where: { id: meetingId },
      data: {
        summary: parsed.summary,
        nextSteps: parsed.nextSteps,
        summarizedAt: new Date(),
        actionItems: {
          create: (parsed.actionItems ?? []).map((item) => ({
            title: item.title,
            owner: item.owner,
          })),
        },
      },
    }),
  ]);

  await prisma.knowledgeDocument.upsert({
    where: { id: `meeting-${meetingId}` },
    create: {
      id: `meeting-${meetingId}`,
      clientId: meeting.clientId,
      title: `Call: ${meeting.title}`,
      source: "TRANSCRIPT",
      sourceRef: meetingId,
      summary: parsed.summary,
      content: [
        `Summary: ${parsed.summary}`,
        `Next steps: ${parsed.nextSteps}`,
        "Transcript:",
        meeting.transcript,
      ].join("\n\n"),
    },
    update: {
      summary: parsed.summary,
      content: [
        `Summary: ${parsed.summary}`,
        `Next steps: ${parsed.nextSteps}`,
        "Transcript:",
        meeting.transcript,
      ].join("\n\n"),
      updatedAt: new Date(),
    },
  });

  return parsed;
}
