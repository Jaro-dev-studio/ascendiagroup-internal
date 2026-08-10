import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/integrations/gmail";
import { logCrmActivity } from "@/lib/crm/activity";
import { reportOpsFailure } from "@/lib/ops-alerts";
import { checkSendEligibility } from "@/lib/crm/sequences/suppression";
import {
  appendTrackingPixel,
  appendUnsubscribeFooter,
  buildUnsubscribeHeaders,
  renderTemplate,
  rewriteLinksForTracking,
  type RenderContext,
} from "@/lib/crm/sequences/render";
import {
  computeNextSendAt,
  isWithinSendWindow,
  startOfZonedDay,
  toSendWindow,
} from "@/lib/crm/sequences/schedule";
import type { EnrollmentStatus, Prisma } from "@prisma/client";

const LOG = "[Sequences]";

/** Bounded per run so a cron invocation always finishes inside its timeout. */
const MAX_SENDS_PER_RUN = 40;

export interface SequenceRunSummary {
  due: number;
  sent: number;
  skipped: number;
  stopped: number;
  completed: number;
  failed: number;
  errors: string[];
}

type DueEnrollment = Prisma.SequenceEnrollmentGetPayload<{
  include: {
    sequence: { include: { steps: true } };
    person: { include: { company: { select: { name: true } } } };
    messages: {
      select: {
        stepId: true;
        rfcMessageId: true;
        gmailThreadId: true;
        sentAt: true;
      };
    };
  };
}>;

function buildRenderContext(enrollment: DueEnrollment): RenderContext {
  const person = enrollment.person;
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  const senderName = enrollment.sequence.senderName ?? "Jaro.dev";

  return {
    firstName: person.firstName,
    lastName: person.lastName,
    fullName: fullName || null,
    email: person.email,
    jobTitle: person.jobTitle,
    companyName: person.company?.name ?? null,
    senderName,
    senderFirstName: senderName.split(" ")[0],
  };
}

async function stopEnrollment(
  enrollmentId: string,
  status: EnrollmentStatus,
  reason: string
): Promise<void> {
  await prisma.sequenceEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status,
      stoppedReason: reason,
      nextSendAt: null,
      ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
  });
}

/**
 * Counts sends already made today for a sequence, so the daily cap is honoured
 * across cron runs rather than per run.
 */
async function countSentToday(
  sequenceId: string,
  timezone: string
): Promise<number> {
  return prisma.sequenceMessage.count({
    where: {
      enrollment: { sequenceId },
      sentAt: { gte: startOfZonedDay(new Date(), timezone) },
    },
  });
}

async function sendStep(
  enrollment: DueEnrollment,
  summary: SequenceRunSummary
): Promise<void> {
  const sequence = enrollment.sequence;
  const steps = [...sequence.steps].sort((a, b) => a.order - b.order);
  const step = steps[enrollment.currentStep];

  if (!step) {
    console.log(`${LOG} enrollment ${enrollment.id} has no further steps`);
    await stopEnrollment(enrollment.id, "COMPLETED", "All steps sent");
    summary.completed += 1;
    return;
  }

  const email = enrollment.person.email;

  if (!email) {
    await stopEnrollment(enrollment.id, "FAILED", "Contact has no email address");
    summary.failed += 1;
    return;
  }

  const eligibility = await checkSendEligibility(email);
  if (!eligibility.canSend) {
    console.log(`${LOG} skipping ${email}: ${eligibility.reason}`);
    await stopEnrollment(
      enrollment.id,
      eligibility.reason?.startsWith("Suppressed (unsubscribed")
        ? "UNSUBSCRIBED"
        : "STOPPED",
      eligibility.reason ?? "Not eligible"
    );
    summary.stopped += 1;
    return;
  }

  const context = buildRenderContext(enrollment);
  const subject = renderTemplate(step.subject, context);
  const renderedBody = renderTemplate(step.bodyHtml, context);

  // Threading only makes sense once a first message exists in the conversation
  const previousMessage = [...enrollment.messages]
    .filter((message) => message.sentAt)
    .sort(
      (a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0)
    )[0];

  const shouldThread = step.sendInThread && Boolean(enrollment.gmailThreadId);

  console.log(
    `${LOG} sending step ${step.order} of "${sequence.name}" to ${email}` +
      (shouldThread ? " (in thread)" : "")
  );

  // The row is created first so tracking URLs can reference its id
  const message = await prisma.sequenceMessage.create({
    data: {
      enrollmentId: enrollment.id,
      stepId: step.id,
      toEmail: email,
      subject,
      body: renderedBody,
    },
    select: { id: true },
  });

  let html = appendUnsubscribeFooter(
    renderedBody,
    email,
    context.senderName ?? "Jaro.dev"
  );

  if (sequence.trackClicks) {
    html = rewriteLinksForTracking(html, message.id);
  }
  if (sequence.trackOpens) {
    html = appendTrackingPixel(html, message.id);
  }

  const result = await sendEmail({
    to: email,
    // Replies stay in the same conversation, so Gmail needs the "Re:" prefix
    subject: shouldThread ? `Re: ${subject.replace(/^Re:\s*/i, "")}` : subject,
    html,
    from: enrollment.senderEmail,
    fromName: sequence.senderName ?? undefined,
    threadId: shouldThread ? enrollment.gmailThreadId : null,
    inReplyTo: shouldThread ? previousMessage?.rfcMessageId : null,
    headers: buildUnsubscribeHeaders(email),
  });

  if (!result.data) {
    console.error(`${LOG} send failed for ${email}: ${result.error}`);
    await prisma.sequenceMessage.update({
      where: { id: message.id },
      data: { error: result.error },
    });
    summary.failed += 1;
    summary.errors.push(`${email}: ${result.error}`);

    // Leave the enrollment due so the next run retries rather than dropping it
    await prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: { nextSendAt: new Date(Date.now() + 3_600_000) },
    });
    return;
  }

  const sentAt = new Date();

  await prisma.sequenceMessage.update({
    where: { id: message.id },
    data: {
      gmailMessageId: result.data.gmailMessageId,
      gmailThreadId: result.data.gmailThreadId,
      rfcMessageId: result.data.rfcMessageId,
      sentAt,
    },
  });

  const nextStep = steps[enrollment.currentStep + 1];
  const window = toSendWindow(sequence);

  await prisma.sequenceEnrollment.update({
    where: { id: enrollment.id },
    data: {
      currentStep: enrollment.currentStep + 1,
      gmailThreadId: enrollment.gmailThreadId ?? result.data.gmailThreadId,
      nextSendAt: nextStep ? computeNextSendAt(sentAt, nextStep, window) : null,
      ...(nextStep
        ? {}
        : { status: "COMPLETED" as const, completedAt: sentAt }),
    },
  });

  await logCrmActivity({
    type: "SEQUENCE_STEP_SENT",
    title: `${sequence.name}: step ${step.order} sent`,
    body: subject,
    personId: enrollment.personId,
    companyId: enrollment.person.companyId,
    occurredAt: sentAt,
    payload: {
      sequenceId: sequence.id,
      stepId: step.id,
      stepOrder: step.order,
      messageId: message.id,
    },
    externalId: `sequence-message:${message.id}`,
  });

  summary.sent += 1;
  if (!nextStep) summary.completed += 1;
}

/**
 * Sends every enrollment that is due, honouring send windows, timezones and the
 * per-sequence daily cap.
 *
 * Called by /api/cron/process-sequences every 5 minutes.
 */
export async function processDueSequences(): Promise<{
  data: SequenceRunSummary | null;
  error: string | null;
}> {
  const summary: SequenceRunSummary = {
    due: 0,
    sent: 0,
    skipped: 0,
    stopped: 0,
    completed: 0,
    failed: 0,
    errors: [],
  };

  try {
    const now = new Date();

    console.log(`${LOG} looking for due enrollments...`);

    const due = await prisma.sequenceEnrollment.findMany({
      where: {
        status: "ACTIVE",
        nextSendAt: { lte: now },
        sequence: { status: "ACTIVE" },
      },
      include: {
        sequence: { include: { steps: true } },
        person: { include: { company: { select: { name: true } } } },
        messages: {
          select: {
            stepId: true,
            rfcMessageId: true,
            gmailThreadId: true,
            sentAt: true,
          },
        },
      },
      orderBy: { nextSendAt: "asc" },
      take: MAX_SENDS_PER_RUN * 3,
    });

    summary.due = due.length;

    if (due.length === 0) {
      console.log(`${LOG} nothing due`);
      return { data: summary, error: null };
    }

    console.log(`${LOG} ${due.length} enrollment(s) due`);

    // Daily caps are per sequence, so track remaining headroom as we go
    const remainingToday = new Map<string, number>();

    for (const enrollment of due) {
      if (summary.sent >= MAX_SENDS_PER_RUN) {
        console.log(`${LOG} reached the per-run send limit, stopping here`);
        break;
      }

      const sequence = enrollment.sequence;
      const window = toSendWindow(sequence);

      if (!isWithinSendWindow(now, window)) {
        summary.skipped += 1;
        continue;
      }

      if (!remainingToday.has(sequence.id)) {
        const sentToday = await countSentToday(sequence.id, sequence.timezone);
        remainingToday.set(
          sequence.id,
          Math.max(0, sequence.dailySendLimit - sentToday)
        );
      }

      const remaining = remainingToday.get(sequence.id) ?? 0;
      if (remaining <= 0) {
        console.log(
          `${LOG} "${sequence.name}" hit its daily limit of ${sequence.dailySendLimit}`
        );
        summary.skipped += 1;
        continue;
      }

      try {
        await sendStep(enrollment, summary);
        remainingToday.set(sequence.id, remaining - 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${LOG} enrollment ${enrollment.id} failed:`, message);
        summary.failed += 1;
        summary.errors.push(`${enrollment.id}: ${message}`);
      }
    }

    console.log(
      `${LOG} run finished: ${summary.sent} sent, ${summary.skipped} skipped, ` +
        `${summary.stopped} stopped, ${summary.completed} completed, ${summary.failed} failed`
    );

    // Reported here rather than in the cron route so a manual "run now" surfaces
    // failed sends too. A contact left unmailed is invisible otherwise.
    if (summary.errors.length > 0) {
      await reportOpsFailure({
        source: "Sequences",
        severity: "WARNING",
        summary: `${summary.failed} of ${summary.due} due sequence step(s) failed to send`,
        details: summary.errors,
        context: { sent: summary.sent, skipped: summary.skipped },
        url: "/dashboard/crm/sequences",
      });
    }

    return { data: summary, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} run failed:`, message);
    await reportOpsFailure({
      source: "Sequences",
      summary: "Sequence run failed before completing",
      error,
      url: "/dashboard/crm/sequences",
    });
    return { data: null, error: message };
  }
}
