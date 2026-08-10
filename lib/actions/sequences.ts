"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth-helpers";
import { isWorkspaceMailbox, getWorkspaceDomain } from "@/lib/integrations/google-auth";
import { verifyMailbox } from "@/lib/integrations/gmail";
import { getEnrollableContacts } from "@/lib/fetchers/sequences";
import { enrollPeople, enrollPerson } from "@/lib/crm/sequences/enroll";
import { processDueSequences } from "@/lib/crm/sequences/engine";
import { syncSequenceReplies } from "@/lib/crm/sequences/replies";
import {
  addSuppression,
  removeSuppression,
} from "@/lib/crm/sequences/suppression";
import {
  computeNextSendAt,
  toSendWindow,
} from "@/lib/crm/sequences/schedule";
import {
  enrollMatchingContacts,
  previewEntryCriteria,
  type EntryCriteriaPreview,
} from "@/lib/crm/sequences/entry-criteria";
import {
  previewExitCriteria,
  type ExitCriteriaPreview,
} from "@/lib/crm/sequences/exit-criteria";
import {
  countActiveConditions,
  normaliseFilterGroup,
} from "@/components/crm-table/utils";
import type { CrmFilterGroup } from "@/components/crm-table/types";
import { Prisma, type SequenceStatus } from "@prisma/client";

const LIST_PATH = "/dashboard/crm/sequences";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

export interface SequenceSettingsInput {
  name: string;
  description?: string | null;
  senderEmail: string;
  senderName?: string | null;
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
  entryFilters?: CrmFilterGroup | null;
  exitFilters?: CrmFilterGroup | null;
}

/** Filter trees are normalised on the way in so a stale shape cannot reach the
 * query builder, and cleared to a real NULL when emptied. */
function toFilterColumn(
  filters: CrmFilterGroup | null | undefined
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!filters) return Prisma.DbNull;
  const group = normaliseFilterGroup(filters);
  return countActiveConditions(group) === 0
    ? Prisma.DbNull
    : (group as unknown as Prisma.InputJsonValue);
}

function validateSettings(
  input: SequenceSettingsInput
): { ok: true } | { ok: false; error: string } {
  if (!input.name.trim()) return { ok: false, error: "Give the sequence a name" };

  if (!isWorkspaceMailbox(input.senderEmail)) {
    return {
      ok: false,
      error: `The sender must be an @${getWorkspaceDomain()} mailbox`,
    };
  }

  if (input.sendWindowStart >= input.sendWindowEnd) {
    return {
      ok: false,
      error: "The send window must start before it ends",
    };
  }

  return { ok: true };
}

function sanitiseSettings(input: SequenceSettingsInput) {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    senderEmail: input.senderEmail.toLowerCase().trim(),
    senderName: input.senderName?.trim() || null,
    timezone: input.timezone,
    sendWindowStart: Math.max(0, Math.min(23, Math.round(input.sendWindowStart))),
    sendWindowEnd: Math.max(1, Math.min(24, Math.round(input.sendWindowEnd))),
    sendOnWeekends: input.sendOnWeekends,
    dailySendLimit: Math.max(1, Math.min(500, Math.round(input.dailySendLimit))),
    stopOnReply: input.stopOnReply,
    stopOnMeetingBooked: input.stopOnMeetingBooked,
    trackOpens: input.trackOpens,
    trackClicks: input.trackClicks,
    autoEnrollEnabled: input.autoEnrollEnabled,
    entryFilters: toFilterColumn(input.entryFilters),
    exitFilters: toFilterColumn(input.exitFilters),
  };
}

export async function createSequence(
  input: SequenceSettingsInput
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    const validation = validateSettings(input);
    if (!validation.ok) return { data: null, error: validation.error };

    console.log(`[Sequences] creating sequence "${input.name}"...`);

    const sequence = await prisma.sequence.create({
      data: { ...sanitiseSettings(input), createdById: admin.id },
      select: { id: true },
    });

    revalidatePath(LIST_PATH);
    return { data: sequence, error: null };
  } catch (error) {
    console.error("[Sequences] failed to create sequence:", error);
    return { data: null, error: "Failed to create sequence" };
  }
}

export async function updateSequence(
  id: string,
  input: SequenceSettingsInput
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    const validation = validateSettings(input);
    if (!validation.ok) return { data: null, error: validation.error };

    console.log(`[Sequences] updating sequence ${id}...`);

    await prisma.sequence.update({
      where: { id },
      data: sanitiseSettings(input),
    });

    revalidatePath(LIST_PATH);
    revalidatePath(detailPath(id));
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Sequences] failed to update sequence:", error);
    return { data: null, error: "Failed to update sequence" };
  }
}

/**
 * Activating a sequence requires steps and a mailbox that really sends, so a
 * misconfigured sender is caught here rather than silently failing per contact.
 */
export async function setSequenceStatus(
  id: string,
  status: SequenceStatus
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    const sequence = await prisma.sequence.findUnique({
      where: { id },
      select: {
        senderEmail: true,
        _count: { select: { steps: true } },
      },
    });

    if (!sequence) return { data: null, error: "Sequence not found" };

    if (status === "ACTIVE") {
      if (sequence._count.steps === 0) {
        return { data: null, error: "Add at least one step before activating" };
      }

      console.log(
        `[Sequences] verifying sender ${sequence.senderEmail} before activating...`
      );
      const mailbox = await verifyMailbox(sequence.senderEmail);
      if (!mailbox.data) {
        return {
          data: null,
          error: `Cannot send from ${sequence.senderEmail}: ${mailbox.error}`,
        };
      }
    }

    console.log(`[Sequences] setting sequence ${id} to ${status}`);

    await prisma.sequence.update({ where: { id }, data: { status } });

    // Pausing a sequence must also stop its in-flight enrollments
    if (status === "PAUSED" || status === "ARCHIVED") {
      await prisma.sequenceEnrollment.updateMany({
        where: { sequenceId: id, status: "ACTIVE" },
        data: { status: "PAUSED" },
      });
    }

    revalidatePath(LIST_PATH);
    revalidatePath(detailPath(id));
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Sequences] failed to change status:", error);
    return { data: null, error: "Failed to change sequence status" };
  }
}

export async function deleteSequence(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    console.log(`[Sequences] deleting sequence ${id}...`);
    await prisma.sequence.delete({ where: { id } });

    revalidatePath(LIST_PATH);
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Sequences] failed to delete sequence:", error);
    return { data: null, error: "Failed to delete sequence" };
  }
}

export interface SequenceStepInput {
  delayDays: number;
  delayHours: number;
  subject: string;
  bodyHtml: string;
  sendInThread: boolean;
}

export async function createSequenceStep(
  sequenceId: string,
  input: SequenceStepInput
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    if (!input.subject.trim()) {
      return { data: null, error: "Give the step a subject" };
    }
    if (!input.bodyHtml.trim()) {
      return { data: null, error: "Write the email body" };
    }

    const last = await prisma.sequenceStep.findFirst({
      where: { sequenceId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const order = (last?.order ?? 0) + 1;

    console.log(`[Sequences] adding step ${order} to sequence ${sequenceId}...`);

    const step = await prisma.sequenceStep.create({
      data: {
        sequenceId,
        order,
        delayDays: Math.max(0, Math.round(input.delayDays)),
        delayHours: Math.max(0, Math.min(23, Math.round(input.delayHours))),
        subject: input.subject.trim(),
        bodyHtml: input.bodyHtml,
        // The first step starts the conversation, so it can never be a reply
        sendInThread: order === 1 ? false : input.sendInThread,
      },
      select: { id: true },
    });

    revalidatePath(detailPath(sequenceId));
    return { data: step, error: null };
  } catch (error) {
    console.error("[Sequences] failed to create step:", error);
    return { data: null, error: "Failed to add step" };
  }
}

export async function updateSequenceStep(
  stepId: string,
  input: SequenceStepInput
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    if (!input.subject.trim()) {
      return { data: null, error: "Give the step a subject" };
    }

    const step = await prisma.sequenceStep.update({
      where: { id: stepId },
      data: {
        delayDays: Math.max(0, Math.round(input.delayDays)),
        delayHours: Math.max(0, Math.min(23, Math.round(input.delayHours))),
        subject: input.subject.trim(),
        bodyHtml: input.bodyHtml,
        sendInThread: input.sendInThread,
      },
      select: { id: true, sequenceId: true, order: true },
    });

    if (step.order === 1 && input.sendInThread) {
      await prisma.sequenceStep.update({
        where: { id: stepId },
        data: { sendInThread: false },
      });
    }

    revalidatePath(detailPath(step.sequenceId));
    return { data: { id: step.id }, error: null };
  } catch (error) {
    console.error("[Sequences] failed to update step:", error);
    return { data: null, error: "Failed to update step" };
  }
}

/**
 * Removes a step and closes the gap in the ordering. Enrollments that already
 * passed the removed step keep their position, so nobody gets a duplicate send.
 */
export async function deleteSequenceStep(
  stepId: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    const step = await prisma.sequenceStep.findUnique({
      where: { id: stepId },
      select: { id: true, sequenceId: true, order: true },
    });

    if (!step) return { data: null, error: "Step not found" };

    console.log(`[Sequences] deleting step ${step.order} of ${step.sequenceId}...`);

    await prisma.sequenceStep.delete({ where: { id: stepId } });

    const remaining = await prisma.sequenceStep.findMany({
      where: { sequenceId: step.sequenceId },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    });

    // Renumber in two passes: the unique [sequenceId, order] index would collide
    // if a later step were moved onto an order still held by another row.
    for (const [index, remainingStep] of remaining.entries()) {
      if (remainingStep.order === index + 1) continue;
      await prisma.sequenceStep.update({
        where: { id: remainingStep.id },
        data: { order: -(index + 1) },
      });
    }
    for (const [index, remainingStep] of remaining.entries()) {
      await prisma.sequenceStep.update({
        where: { id: remainingStep.id },
        data: { order: index + 1 },
      });
    }

    revalidatePath(detailPath(step.sequenceId));
    return { data: { id: stepId }, error: null };
  } catch (error) {
    console.error("[Sequences] failed to delete step:", error);
    return { data: null, error: "Failed to delete step" };
  }
}

export async function moveSequenceStep(
  stepId: string,
  direction: "up" | "down"
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    const step = await prisma.sequenceStep.findUnique({
      where: { id: stepId },
      select: { id: true, sequenceId: true, order: true },
    });

    if (!step) return { data: null, error: "Step not found" };

    const neighbour = await prisma.sequenceStep.findFirst({
      where: {
        sequenceId: step.sequenceId,
        order: direction === "up" ? step.order - 1 : step.order + 1,
      },
      select: { id: true, order: true },
    });

    if (!neighbour) return { data: { id: stepId }, error: null };

    // Park one row on a negative order so the unique index is never violated
    await prisma.sequenceStep.update({
      where: { id: step.id },
      data: { order: -step.order },
    });
    await prisma.sequenceStep.update({
      where: { id: neighbour.id },
      data: { order: step.order },
    });
    await prisma.sequenceStep.update({
      where: { id: step.id },
      data: { order: neighbour.order },
    });

    // Step one always starts a new thread
    await prisma.sequenceStep.updateMany({
      where: { sequenceId: step.sequenceId, order: 1 },
      data: { sendInThread: false },
    });

    revalidatePath(detailPath(step.sequenceId));
    return { data: { id: stepId }, error: null };
  } catch (error) {
    console.error("[Sequences] failed to move step:", error);
    return { data: null, error: "Failed to reorder step" };
  }
}

/** Powers the enrollment picker's search box. */
export async function searchEnrollableContacts(
  sequenceId: string,
  search: string
): Promise<{
  data: Array<{
    id: string;
    name: string;
    email: string;
    companyName: string | null;
  }> | null;
  error: string | null;
}> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  return getEnrollableContacts(sequenceId, search.trim() || undefined);
}

export async function enrollContacts(
  sequenceId: string,
  personIds: string[]
): Promise<{
  data: { enrolled: number; skipped: number; alreadyEnrolled: number } | null;
  error: string | null;
}> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  const result = await enrollPeople(sequenceId, personIds);
  revalidatePath(detailPath(sequenceId));
  return result;
}

export async function enrollContact(
  sequenceId: string,
  personId: string
): Promise<{ data: { enrollmentId: string } | null; error: string | null }> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  const result = await enrollPerson(sequenceId, personId);
  revalidatePath(detailPath(sequenceId));

  if (!result.data) return { data: null, error: result.error };
  if (result.data.status === "skipped") {
    return { data: null, error: result.data.reason ?? "Contact is not eligible" };
  }

  return { data: { enrollmentId: result.data.enrollmentId }, error: null };
}

export async function setEnrollmentStatus(
  enrollmentId: string,
  status: "ACTIVE" | "PAUSED" | "STOPPED"
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    const enrollment = await prisma.sequenceEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { sequence: { include: { steps: { orderBy: { order: "asc" } } } } },
    });

    if (!enrollment) return { data: null, error: "Enrollment not found" };

    // Resuming needs a fresh due time, otherwise a long pause fires immediately
    let nextSendAt: Date | null = null;
    if (status === "ACTIVE") {
      const nextStep = enrollment.sequence.steps[enrollment.currentStep];
      if (!nextStep) {
        return { data: null, error: "This enrollment has no remaining steps" };
      }
      nextSendAt = computeNextSendAt(
        new Date(),
        { delayDays: 0, delayHours: 0 },
        toSendWindow(enrollment.sequence)
      );
    }

    console.log(`[Sequences] setting enrollment ${enrollmentId} to ${status}`);

    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status,
        nextSendAt,
        stoppedReason: status === "STOPPED" ? "Stopped manually" : null,
      },
    });

    revalidatePath(detailPath(enrollment.sequenceId));
    return { data: { id: enrollmentId }, error: null };
  } catch (error) {
    console.error("[Sequences] failed to update enrollment:", error);
    return { data: null, error: "Failed to update enrollment" };
  }
}

export async function removeEnrollment(
  enrollmentId: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { data: null, error: "Unauthorized" };

    const enrollment = await prisma.sequenceEnrollment.findUnique({
      where: { id: enrollmentId },
      select: { sequenceId: true },
    });

    if (!enrollment) return { data: null, error: "Enrollment not found" };

    await prisma.sequenceEnrollment.delete({ where: { id: enrollmentId } });

    revalidatePath(detailPath(enrollment.sequenceId));
    return { data: { id: enrollmentId }, error: null };
  } catch (error) {
    console.error("[Sequences] failed to remove enrollment:", error);
    return { data: null, error: "Failed to remove enrollment" };
  }
}

export async function addSuppressionEntry(
  email: string,
  note?: string
): Promise<{ data: { email: string } | null; error: string | null }> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  const result = await addSuppression(email, "manual", note);
  revalidatePath(`${LIST_PATH}/suppressions`);
  return result;
}

export async function removeSuppressionEntry(
  email: string
): Promise<{ data: { email: string } | null; error: string | null }> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  const result = await removeSuppression(email);
  revalidatePath(`${LIST_PATH}/suppressions`);
  return result;
}

/** Runs the sending cron on demand, for testing a sequence without waiting. */
export async function runSequencesNow(): Promise<{
  data: { sent: number; skipped: number; failed: number } | null;
  error: string | null;
}> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  console.log("[Sequences] manual send run requested...");
  const result = await processDueSequences();

  revalidatePath(LIST_PATH);

  if (!result.data) return { data: null, error: result.error };

  return {
    data: {
      sent: result.data.sent,
      skipped: result.data.skipped,
      failed: result.data.failed,
    },
    error: null,
  };
}

export async function syncRepliesNow(): Promise<{
  data: { replies: number; bounces: number } | null;
  error: string | null;
}> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  const result = await syncSequenceReplies();
  revalidatePath(LIST_PATH);

  if (!result.data) return { data: null, error: result.error };

  return {
    data: { replies: result.data.replies, bounces: result.data.bounces },
    error: null,
  };
}

/**
 * Counts who a criteria set would pick up. Called as the builder is edited, so
 * it takes the draft filters rather than reading them back from the sequence.
 */
export async function previewSequenceEntryCriteria(
  filters: CrmFilterGroup,
  sequenceId: string | null,
  exitFilters?: CrmFilterGroup | null
): Promise<{ data: EntryCriteriaPreview | null; error: string | null }> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  return previewEntryCriteria(filters, sequenceId, exitFilters ?? undefined);
}

/** Counts how many of a sequence's active contacts the exit criteria would stop. */
export async function previewSequenceExitCriteria(
  filters: CrmFilterGroup,
  sequenceId: string | null
): Promise<{ data: ExitCriteriaPreview | null; error: string | null }> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  return previewExitCriteria(filters, sequenceId);
}

/** Enrolls everyone currently matching the sequence's saved entry criteria. */
export async function enrollMatchingEntryCriteria(
  sequenceId: string
): Promise<{ data: { enrolled: number } | null; error: string | null }> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  const result = await enrollMatchingContacts(sequenceId);
  revalidatePath(detailPath(sequenceId));
  return result;
}

/** Verifies a mailbox can send, for the sequence settings form. */
export async function testSenderMailbox(
  email: string
): Promise<{ data: { emailAddress: string } | null; error: string | null }> {
  const admin = await getAdminUser();
  if (!admin) return { data: null, error: "Unauthorized" };

  return verifyMailbox(email);
}
