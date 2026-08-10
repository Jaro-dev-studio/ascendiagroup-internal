import prisma from "@/lib/prisma";
import { isGmailConfigured } from "@/lib/integrations/gmail";
import { isWorkspaceMailbox, getWorkspaceDomain } from "@/lib/integrations/google-auth";
import { resolveEntryFilters } from "@/lib/crm/sequences/entry-criteria";
import { resolveExitFilters } from "@/lib/crm/sequences/exit-criteria";
import {
  countActiveConditions,
  createFilterGroup,
} from "@/components/crm-table/utils";
import type { CrmFilterGroup } from "@/components/crm-table/types";
import type { EnrollmentStatus, SequenceStatus } from "@prisma/client";

export interface SequenceListItem {
  id: string;
  name: string;
  description: string | null;
  status: SequenceStatus;
  senderEmail: string;
  senderName: string | null;
  stepCount: number;
  activeEnrollments: number;
  totalEnrollments: number;
  sent: number;
  replied: number;
  autoEnrollEnabled: boolean;
  entryCriteriaCount: number;
  updatedAt: Date;
}

export interface SequenceStepView {
  id: string;
  order: number;
  delayDays: number;
  delayHours: number;
  subject: string;
  bodyHtml: string;
  sendInThread: boolean;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  failed: number;
}

export interface SequenceEnrollmentView {
  id: string;
  status: EnrollmentStatus;
  currentStep: number;
  nextSendAt: Date | null;
  stoppedReason: string | null;
  createdAt: Date;
  personId: string;
  personName: string;
  personEmail: string | null;
  companyName: string | null;
  lastSentAt: Date | null;
}

export interface SequenceDetail {
  id: string;
  name: string;
  description: string | null;
  status: SequenceStatus;
  senderEmail: string;
  senderName: string | null;
  timezone: string;
  sendWindowStart: number;
  sendWindowEnd: number;
  sendOnWeekends: boolean;
  dailySendLimit: number;
  stopOnReply: boolean;
  stopOnMeetingBooked: boolean;
  trackOpens: boolean;
  trackClicks: boolean;
  autoEnrollEnabled: boolean;
  /** Resolved criteria, including the legacy form-type fallback. */
  entryFilters: CrmFilterGroup;
  exitFilters: CrmFilterGroup;
  steps: SequenceStepView[];
  enrollments: SequenceEnrollmentView[];
  counts: Record<EnrollmentStatus, number>;
}

const EMPTY_COUNTS: Record<EnrollmentStatus, number> = {
  ACTIVE: 0,
  PAUSED: 0,
  COMPLETED: 0,
  REPLIED: 0,
  BOUNCED: 0,
  UNSUBSCRIBED: 0,
  STOPPED: 0,
  FAILED: 0,
};

function personLabel(person: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}): string {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ");
  return name || person.email || "Unknown contact";
}

export async function getSequences(): Promise<{
  data: SequenceListItem[] | null;
  error: string | null;
}> {
  try {
    const sequences = await prisma.sequence.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        _count: { select: { steps: true, enrollments: true } },
        enrollments: { select: { status: true } },
      },
    });

    const messageStats = await prisma.sequenceMessage.groupBy({
      by: ["enrollmentId"],
      _count: { _all: true },
    });

    // Map enrollment -> sequence so message counts can be rolled up per sequence
    const enrollmentToSequence = new Map<string, string>();
    if (messageStats.length > 0) {
      const enrollments = await prisma.sequenceEnrollment.findMany({
        where: { id: { in: messageStats.map((row) => row.enrollmentId) } },
        select: { id: true, sequenceId: true },
      });
      for (const enrollment of enrollments) {
        enrollmentToSequence.set(enrollment.id, enrollment.sequenceId);
      }
    }

    const sentBySequence = new Map<string, number>();
    for (const row of messageStats) {
      const sequenceId = enrollmentToSequence.get(row.enrollmentId);
      if (!sequenceId) continue;
      sentBySequence.set(
        sequenceId,
        (sentBySequence.get(sequenceId) ?? 0) + row._count._all
      );
    }

    return {
      data: sequences.map((sequence) => ({
        id: sequence.id,
        name: sequence.name,
        description: sequence.description,
        status: sequence.status,
        senderEmail: sequence.senderEmail,
        senderName: sequence.senderName,
        stepCount: sequence._count.steps,
        totalEnrollments: sequence._count.enrollments,
        activeEnrollments: sequence.enrollments.filter(
          (enrollment) => enrollment.status === "ACTIVE"
        ).length,
        sent: sentBySequence.get(sequence.id) ?? 0,
        replied: sequence.enrollments.filter(
          (enrollment) => enrollment.status === "REPLIED"
        ).length,
        autoEnrollEnabled: sequence.autoEnrollEnabled,
        entryCriteriaCount: countActiveConditions(
          resolveEntryFilters(sequence) ?? createFilterGroup()
        ),
        updatedAt: sequence.updatedAt,
      })),
      error: null,
    };
  } catch (error) {
    console.error("[Sequences] failed to fetch sequences:", error);
    return { data: null, error: "Failed to load sequences" };
  }
}

export async function getSequenceDetail(id: string): Promise<{
  data: SequenceDetail | null;
  error: string | null;
}> {
  try {
    const sequence = await prisma.sequence.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { order: "asc" },
          include: {
            messages: {
              select: {
                sentAt: true,
                openedAt: true,
                clickedAt: true,
                repliedAt: true,
                bouncedAt: true,
                error: true,
              },
            },
          },
        },
        enrollments: {
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            person: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                company: { select: { name: true } },
              },
            },
            messages: {
              where: { sentAt: { not: null } },
              orderBy: { sentAt: "desc" },
              take: 1,
              select: { sentAt: true },
            },
          },
        },
      },
    });

    if (!sequence) return { data: null, error: "Sequence not found" };

    const counts = { ...EMPTY_COUNTS };
    const statusCounts = await prisma.sequenceEnrollment.groupBy({
      by: ["status"],
      where: { sequenceId: id },
      _count: { _all: true },
    });
    for (const row of statusCounts) {
      counts[row.status] = row._count._all;
    }

    return {
      data: {
        id: sequence.id,
        name: sequence.name,
        description: sequence.description,
        status: sequence.status,
        senderEmail: sequence.senderEmail,
        senderName: sequence.senderName,
        timezone: sequence.timezone,
        sendWindowStart: sequence.sendWindowStart,
        sendWindowEnd: sequence.sendWindowEnd,
        sendOnWeekends: sequence.sendOnWeekends,
        dailySendLimit: sequence.dailySendLimit,
        stopOnReply: sequence.stopOnReply,
        stopOnMeetingBooked: sequence.stopOnMeetingBooked,
        trackOpens: sequence.trackOpens,
        trackClicks: sequence.trackClicks,
        autoEnrollEnabled: sequence.autoEnrollEnabled,
        entryFilters: resolveEntryFilters(sequence) ?? createFilterGroup(),
        exitFilters: resolveExitFilters(sequence) ?? createFilterGroup(),
        steps: sequence.steps.map((step) => ({
          id: step.id,
          order: step.order,
          delayDays: step.delayDays,
          delayHours: step.delayHours,
          subject: step.subject,
          bodyHtml: step.bodyHtml,
          sendInThread: step.sendInThread,
          sent: step.messages.filter((message) => message.sentAt).length,
          opened: step.messages.filter((message) => message.openedAt).length,
          clicked: step.messages.filter((message) => message.clickedAt).length,
          replied: step.messages.filter((message) => message.repliedAt).length,
          bounced: step.messages.filter((message) => message.bouncedAt).length,
          failed: step.messages.filter(
            (message) => message.error && !message.sentAt
          ).length,
        })),
        enrollments: sequence.enrollments.map((enrollment) => ({
          id: enrollment.id,
          status: enrollment.status,
          currentStep: enrollment.currentStep,
          nextSendAt: enrollment.nextSendAt,
          stoppedReason: enrollment.stoppedReason,
          createdAt: enrollment.createdAt,
          personId: enrollment.person.id,
          personName: personLabel(enrollment.person),
          personEmail: enrollment.person.email,
          companyName: enrollment.person.company?.name ?? null,
          lastSentAt: enrollment.messages[0]?.sentAt ?? null,
        })),
        counts,
      },
      error: null,
    };
  } catch (error) {
    console.error("[Sequences] failed to fetch sequence detail:", error);
    return { data: null, error: "Failed to load sequence" };
  }
}

/** Mailboxes a sequence can send from. */
export async function getSenderMailboxes(): Promise<{
  data: Array<{ email: string; name: string }> | null;
  error: string | null;
}> {
  try {
    const users = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        sendingMailbox: true,
      },
      orderBy: { email: "asc" },
    });

    const byEmail = new Map<string, string>();

    // A shared inbox is always an option even when no user owns it
    byEmail.set(`hello@${getWorkspaceDomain()}`, "Jaro.dev (shared)");

    for (const user of users) {
      const mailbox = [user.sendingMailbox, user.email].find(
        (candidate): candidate is string =>
          Boolean(candidate) && isWorkspaceMailbox(candidate as string)
      );
      if (!mailbox) continue;

      byEmail.set(
        mailbox.toLowerCase(),
        [user.firstName, user.lastName].filter(Boolean).join(" ") || mailbox
      );
    }

    return {
      data: Array.from(byEmail.entries()).map(([email, name]) => ({
        email,
        name,
      })),
      error: null,
    };
  } catch (error) {
    console.error("[Sequences] failed to fetch sender mailboxes:", error);
    return { data: null, error: "Failed to load sender mailboxes" };
  }
}

export interface SuppressionView {
  id: string;
  email: string;
  reason: string;
  note: string | null;
  createdAt: Date;
}

export async function getSuppressions(limit = 200): Promise<{
  data: SuppressionView[] | null;
  error: string | null;
}> {
  try {
    const suppressions = await prisma.suppression.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return { data: suppressions, error: null };
  } catch (error) {
    console.error("[Sequences] failed to fetch suppressions:", error);
    return { data: null, error: "Failed to load suppression list" };
  }
}

export async function getSequenceConfigStatus(): Promise<{
  gmailConfigured: boolean;
  workspaceDomain: string;
}> {
  return {
    gmailConfigured: isGmailConfigured(),
    workspaceDomain: getWorkspaceDomain(),
  };
}

/** Contacts that can be enrolled, excluding suppressed and already-enrolled ones. */
export async function getEnrollableContacts(
  sequenceId: string,
  search?: string
): Promise<{
  data: Array<{
    id: string;
    name: string;
    email: string;
    companyName: string | null;
  }> | null;
  error: string | null;
}> {
  try {
    const people = await prisma.person.findMany({
      where: {
        email: { not: null },
        doNotContact: false,
        sequenceEnrollments: { none: { sequenceId } },
        ...(search
          ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        company: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return {
      data: people
        .filter((person): person is typeof person & { email: string } =>
          Boolean(person.email)
        )
        .map((person) => ({
          id: person.id,
          name: personLabel(person),
          email: person.email,
          companyName: person.company?.name ?? null,
        })),
      error: null,
    };
  } catch (error) {
    console.error("[Sequences] failed to fetch enrollable contacts:", error);
    return { data: null, error: "Failed to load contacts" };
  }
}
