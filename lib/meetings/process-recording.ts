import prisma from "@/lib/prisma";
import { isJaroDevTeamEmail } from "@/lib/constants";
import { queueProductBuild } from "@/lib/actions";
import { filterDuplicateSteps } from "@/lib/task-dedup";
import { logCrmActivity } from "@/lib/crm/activity";
import { recomputeEngagementForEmails } from "@/lib/crm/engagement";
import { upsertPersonByEmail } from "@/lib/crm/people";
import { advanceCompanyDeal } from "@/lib/crm/pipeline";
import {
  extractCompanyNameFromEmail,
  formatTranscriptBySpeaker,
  type TranscriptClientUser,
  type TranscriptSegment,
} from "@/lib/meetings/transcript";
import {
  generateMeetingSummary,
  generateObjectionAnalysis,
  type MeetingSummaryResult,
  type ObjectionAnalysisResult,
} from "@/lib/meetings/analysis";
import type { MeetingProvider } from "@prisma/client";
import type { InputJsonValue } from "@prisma/client/runtime/library";

/** Provider-agnostic recording payload handed to the shared processor. */
export interface RecordingInput {
  provider: MeetingProvider;
  /** Stable per-meeting identifier: the calendar event id, or the bot id when there is no event. */
  meetingId: string;
  /** Stable per-recording identifier: the Recall bot id. */
  callRecordingId: string;
  title: string;
  description?: string | null;
  startTime: Date;
  endTime: Date;
  participantEmails: string[];
  transcript: TranscriptSegment[];
  recordingUrl?: string | null;
}

export interface ProcessRecordingResult {
  data: { meetingId: string; skipped: boolean } | null;
  error: string | null;
}

interface CompanyResolution {
  clientCompanyId: string | null;
  clientCompanyName: string | null;
  isNewClient: boolean;
  externalEmail: string | null;
  shouldGenerateDemo: boolean;
}

const BUILD_ELIGIBLE_STATUSES = ["FORM_SUBMITTED", "CALL_BOOKED"];

async function findClientUsersFromParticipants(
  participantEmails: string[]
): Promise<TranscriptClientUser[]> {
  // Participants who are not Jaro.dev team members (excludes @jaro.dev addresses
  // as well as listed team emails like zenoshubh@gmail.com).
  const externalEmails = participantEmails.filter(
    (email) => !isJaroDevTeamEmail(email)
  );

  if (externalEmails.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      email: { in: externalEmails, mode: "insensitive" },
      clientCompanyId: { not: null },
    },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      clientCompanyId: true,
      clientCompany: { select: { id: true, name: true } },
    },
  });

  return users.filter(
    (user): user is TranscriptClientUser =>
      user.clientCompanyId !== null && user.clientCompany !== null
  );
}

/**
 * Resolves which company a call belongs to, creating one from the external
 * participant's email domain when nothing matches, and decides whether the
 * company is eligible for an auto-queued product build.
 */
async function resolveCompany(
  participantEmails: string[],
  clientUsers: TranscriptClientUser[],
  logPrefix: string
): Promise<CompanyResolution> {
  if (clientUsers.length > 0) {
    console.log(
      `${logPrefix} matched existing client company "${clientUsers[0].clientCompany.name}"`
    );
    return {
      clientCompanyId: clientUsers[0].clientCompanyId,
      clientCompanyName: clientUsers[0].clientCompany.name,
      isNewClient: false,
      externalEmail: clientUsers[0].email,
      shouldGenerateDemo: false,
    };
  }

  const externalEmails = participantEmails.filter(
    (email) => !isJaroDevTeamEmail(email)
  );

  if (externalEmails.length === 0) {
    console.log(`${logPrefix} no external participants, leaving company unset`);
    return {
      clientCompanyId: null,
      clientCompanyName: null,
      isNewClient: false,
      externalEmail: null,
      shouldGenerateDemo: false,
    };
  }

  const externalEmail = externalEmails[0];
  const emailDomain = externalEmail.split("@")[1];

  console.log(`${logPrefix} resolving company by domain ${emailDomain}...`);

  const existing = await prisma.company.findFirst({
    where: {
      OR: [
        { website: { equals: emailDomain, mode: "insensitive" } },
        { domain: { equals: emailDomain, mode: "insensitive" } },
        { domains: { has: emailDomain } },
      ],
    },
  });

  if (existing) {
    const buildCount = await prisma.demo.count({
      where: { clientCompanyId: existing.id, status: { not: "rejected" } },
    });

    const shouldGenerateDemo =
      buildCount === 0 && BUILD_ELIGIBLE_STATUSES.includes(existing.status);

    console.log(
      `${logPrefix} found "${existing.name}" (builds=${buildCount}, status=${existing.status}, eligibleForBuild=${shouldGenerateDemo})`
    );

    console.log(`${logPrefix} advancing deal to Attended Call...`);
    await advanceCompanyDeal(existing.id, "Attended Call");

    return {
      clientCompanyId: existing.id,
      clientCompanyName: existing.name,
      isNewClient: false,
      externalEmail,
      shouldGenerateDemo,
    };
  }

  const derivedName = extractCompanyNameFromEmail(externalEmail);
  console.log(`${logPrefix} creating new company "${derivedName}"...`);

  const created = await prisma.company.create({
    data: {
      name: derivedName,
      website: emailDomain,
      domain: emailDomain,
      domains: [emailDomain],
    },
  });

  console.log(`${logPrefix} advancing deal to Attended Call...`);
  await advanceCompanyDeal(created.id, "Attended Call");

  return {
    clientCompanyId: created.id,
    clientCompanyName: created.name,
    isNewClient: true,
    externalEmail,
    shouldGenerateDemo: true,
  };
}

async function createObjections(
  meetingDbId: string,
  analysis: ObjectionAnalysisResult,
  logPrefix: string
): Promise<void> {
  if (analysis.callType !== "SALES_CALL" || analysis.objections.length === 0) {
    return;
  }

  console.log(`${logPrefix} saving ${analysis.objections.length} objections...`);

  await prisma.salesCallObjection.createMany({
    data: analysis.objections.map((objection) => ({
      meetingId: meetingDbId,
      objection: objection.objection,
      response: objection.response,
      resolved: objection.resolved,
      resolutionContext: objection.resolutionContext || null,
      category: objection.category || null,
    })),
  });
}

async function createTasksAndActionItems(
  meetingDbId: string,
  clientCompanyId: string,
  summary: MeetingSummaryResult,
  meetingTitle: string,
  logPrefix: string
): Promise<void> {
  console.log(`${logPrefix} checking existing open steps for duplicates...`);

  const [existingTasks, existingActionItems] = await Promise.all([
    prisma.task.findMany({
      where: { clientCompanyId, status: { not: "DONE" } },
      select: { name: true, description: true },
    }),
    prisma.actionItem.findMany({
      where: { clientCompanyId, status: { not: "DONE" } },
      select: { name: true, description: true },
    }),
  ]);

  const [tasksToCreate, actionItemsToCreate] = await Promise.all([
    filterDuplicateSteps(summary.nextStepsJaroDev, existingTasks, {
      logPrefix: `${logPrefix} task dedup`,
    }),
    filterDuplicateSteps(summary.nextStepsClient, existingActionItems, {
      logPrefix: `${logPrefix} action item dedup`,
    }),
  ]);

  const provenance = `\n\n---\nFrom meeting: ${meetingTitle}`;

  if (tasksToCreate.length > 0) {
    await prisma.task.createMany({
      data: tasksToCreate.map((step) => ({
        name: step.title,
        description: `${step.description}${provenance}`,
        priority: "MEDIUM" as const,
        status: "TODO" as const,
        clientCompanyId,
        meetingId: meetingDbId,
        createdByJaroDevAutomation: true,
      })),
    });
  }

  if (actionItemsToCreate.length > 0) {
    await prisma.actionItem.createMany({
      data: actionItemsToCreate.map((step) => ({
        name: step.title,
        description: `${step.description}${provenance}`,
        priority: "MEDIUM" as const,
        status: "TODO" as const,
        clientCompanyId,
        meetingId: meetingDbId,
        createdByJaroDevAutomation: true,
      })),
    });
  }

  console.log(
    `${logPrefix} created ${tasksToCreate.length} tasks and ${actionItemsToCreate.length} action items`
  );
}

/**
 * Records the call on the CRM timeline against the company and every external
 * participant, creating contacts for participants we have not seen before.
 */
async function recordCrmTimeline(
  input: RecordingInput,
  meetingDbId: string,
  clientCompanyId: string | null,
  summaryText: string | null,
  logPrefix: string
): Promise<void> {
  const externalEmails = input.participantEmails.filter(
    (email) => !isJaroDevTeamEmail(email)
  );

  const personIds: string[] = [];

  for (const email of externalEmails) {
    const result = await upsertPersonByEmail({
      email,
      companyId: clientCompanyId,
      source: `meeting:${input.provider.toLowerCase()}`,
    });
    if (result.data) personIds.push(result.data.id);
  }

  console.log(
    `${logPrefix} logging timeline entry against ${personIds.length} contacts`
  );

  // One entry per contact keeps the person timelines complete; the shared
  // externalId suffix makes each write idempotent across retries.
  if (personIds.length === 0) {
    await logCrmActivity({
      type: "MEETING",
      title: input.title,
      body: summaryText,
      companyId: clientCompanyId,
      meetingId: meetingDbId,
      occurredAt: input.startTime,
      externalId: `meeting:${meetingDbId}`,
    });
    return;
  }

  for (const personId of personIds) {
    await logCrmActivity({
      type: "MEETING",
      title: input.title,
      body: summaryText,
      personId,
      companyId: clientCompanyId,
      meetingId: meetingDbId,
      occurredAt: input.startTime,
      externalId: `meeting:${meetingDbId}:${personId}`,
    });
  }
}

/**
 * Turns a finished recording from any provider into a Meeting row plus its
 * derived summary, tasks, action items, objections, CRM timeline entries and
 * (when the company qualifies) a queued product build.
 *
 * Idempotent: an existing meeting with the same provider identifiers is skipped.
 */
export async function processRecording(
  input: RecordingInput
): Promise<ProcessRecordingResult> {
  const logPrefix = `[Meeting Processor:${input.provider}]`;

  try {
    console.log(
      `${logPrefix} processing "${input.title}" (meeting=${input.meetingId}, recording=${input.callRecordingId})`
    );

    console.log(`${logPrefix} checking for an existing meeting row...`);
    const existing = await prisma.meeting.findFirst({
      where: {
        OR: [
          { meetingId: input.meetingId },
          { callRecordingId: input.callRecordingId },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      console.log(`${logPrefix} already stored as ${existing.id}, skipping`);
      return { data: { meetingId: existing.id, skipped: true }, error: null };
    }

    console.log(`${logPrefix} identifying participants...`);
    const clientUsers = await findClientUsersFromParticipants(
      input.participantEmails
    );

    const company = await resolveCompany(
      input.participantEmails,
      clientUsers,
      logPrefix
    );

    console.log(`${logPrefix} formatting transcript by speaker...`);
    const formattedTranscript = formatTranscriptBySpeaker(
      input.transcript,
      clientUsers
    );

    let summary: MeetingSummaryResult = {
      summary: "",
      nextStepsJaroDev: [],
      nextStepsClient: [],
    };
    let objectionAnalysis: ObjectionAnalysisResult = {
      callType: clientUsers.length > 0 ? "CLIENT_MEETING" : "SALES_CALL",
      objections: [],
    };

    if (formattedTranscript) {
      [summary, objectionAnalysis] = await Promise.all([
        generateMeetingSummary(
          formattedTranscript,
          company.clientCompanyName,
          logPrefix
        ),
        generateObjectionAnalysis(
          formattedTranscript,
          company.clientCompanyName,
          clientUsers.length > 0,
          logPrefix
        ),
      ]);
    } else {
      console.log(`${logPrefix} no transcript content, skipping AI analysis`);
    }

    console.log(`${logPrefix} saving meeting...`);
    const meeting = await prisma.meeting.create({
      data: {
        provider: input.provider,
        meetingId: input.meetingId,
        callRecordingId: input.callRecordingId,
        title: input.title,
        description: input.description ?? null,
        startTime: input.startTime,
        endTime: input.endTime,
        participants: input.participantEmails,
        formattedTranscript,
        rawTranscript: input.transcript as unknown as InputJsonValue,
        clientCompanyId: company.clientCompanyId,
        summary: summary.summary || null,
        nextStepsJaroDev:
          summary.nextStepsJaroDev.length > 0
            ? JSON.stringify(summary.nextStepsJaroDev)
            : null,
        nextStepsClient:
          summary.nextStepsClient.length > 0
            ? JSON.stringify(summary.nextStepsClient)
            : null,
        callType: objectionAnalysis.callType,
        recordingUrl: input.recordingUrl ?? null,
      },
      select: { id: true },
    });

    console.log(`${logPrefix} saved meeting ${meeting.id}`);

    if (
      company.clientCompanyId &&
      (summary.nextStepsJaroDev.length > 0 || summary.nextStepsClient.length > 0)
    ) {
      await createTasksAndActionItems(
        meeting.id,
        company.clientCompanyId,
        summary,
        input.title,
        logPrefix
      );
    }

    await createObjections(meeting.id, objectionAnalysis, logPrefix);

    await recordCrmTimeline(
      input,
      meeting.id,
      company.clientCompanyId,
      summary.summary || null,
      logPrefix
    );

    // Refresh the CRM engagement columns for everyone on this call so the list
    // views reflect it before the next cron sweep. Never fail ingest over it.
    console.log(`${logPrefix} refreshing engagement for participants...`);
    const engagement = await recomputeEngagementForEmails(
      input.participantEmails,
      company.clientCompanyId ? [company.clientCompanyId] : []
    );
    if (engagement.error) {
      console.error(
        `${logPrefix} engagement refresh failed:`,
        engagement.error
      );
    }

    // Build prompt generation is slow; let it finish after we return so the
    // webhook or cron caller is not held open by it.
    if (
      company.shouldGenerateDemo &&
      company.clientCompanyId &&
      company.clientCompanyName &&
      company.externalEmail &&
      formattedTranscript
    ) {
      console.log(
        `${logPrefix} queueing product build (newClient=${company.isNewClient})...`
      );
      queueProductBuild({
        clientCompanyId: company.clientCompanyId,
        clientCompanyName: company.clientCompanyName,
        clientEmail: company.externalEmail,
        transcript: formattedTranscript,
        meetingId: meeting.id,
      })
        .then((result) => {
          if (result.error) {
            console.error(`${logPrefix} build queueing failed:`, result.error);
          } else {
            console.log(
              `${logPrefix} build queued, demoId=${result.data?.demoId}`
            );
          }
        })
        .catch((error) => {
          console.error(`${logPrefix} build queueing error:`, error);
        });
    }

    console.log(`${logPrefix} finished processing "${input.title}"`);
    return { data: { meetingId: meeting.id, skipped: false }, error: null };
  } catch (error) {
    console.error(`${logPrefix} processing failed:`, error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
