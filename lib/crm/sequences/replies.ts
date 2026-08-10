import prisma from "@/lib/prisma";
import { getThreadMessages } from "@/lib/integrations/gmail";
import { logCrmActivity } from "@/lib/crm/activity";
import { recomputeEngagementForPeople } from "@/lib/crm/engagement";
import { addSuppression } from "@/lib/crm/sequences/suppression";
import { isJaroDevTeamEmail } from "@/lib/constants";

const LOG = "[Sequence Replies]";

/** Bounded per run so the cron always returns inside its timeout. */
const MAX_THREADS_PER_RUN = 60;

export interface ReplySyncSummary {
  threadsChecked: number;
  replies: number;
  bounces: number;
  errors: string[];
}

const BOUNCE_SENDERS = [
  "mailer-daemon",
  "postmaster",
  "no-reply@google.com",
];

const BOUNCE_SUBJECT_PATTERNS = [
  "delivery status notification",
  "undeliverable",
  "delivery has failed",
  "address not found",
  "returned mail",
  "mail delivery failed",
  "message blocked",
];

function looksLikeBounce(
  fromEmail: string | null,
  subject: string | null
): boolean {
  const from = (fromEmail ?? "").toLowerCase();
  const subjectLower = (subject ?? "").toLowerCase();

  return (
    BOUNCE_SENDERS.some((sender) => from.includes(sender)) ||
    BOUNCE_SUBJECT_PATTERNS.some((pattern) => subjectLower.includes(pattern))
  );
}

/**
 * Reads each active enrollment's Gmail thread and stops the sequence when the
 * contact answers or the message bounces.
 *
 * Reading the sending mailbox's own thread is enough: a reply lands in the same
 * conversation, so no separate inbox integration is needed.
 */
export async function syncSequenceReplies(): Promise<{
  data: ReplySyncSummary | null;
  error: string | null;
}> {
  const summary: ReplySyncSummary = {
    threadsChecked: 0,
    replies: 0,
    bounces: 0,
    errors: [],
  };

  try {
    console.log(`${LOG} loading active enrollments with a thread...`);

    const enrollments = await prisma.sequenceEnrollment.findMany({
      where: {
        status: { in: ["ACTIVE", "PAUSED"] },
        gmailThreadId: { not: null },
        sequence: { stopOnReply: true },
      },
      select: {
        id: true,
        personId: true,
        senderEmail: true,
        gmailThreadId: true,
        person: { select: { email: true, companyId: true } },
        sequence: { select: { id: true, name: true } },
        messages: {
          where: { sentAt: { not: null } },
          orderBy: { sentAt: "desc" },
          take: 1,
          select: { id: true, sentAt: true },
        },
      },
      orderBy: { updatedAt: "asc" },
      take: MAX_THREADS_PER_RUN,
    });

    if (enrollments.length === 0) {
      console.log(`${LOG} no threads to check`);
      return { data: summary, error: null };
    }

    console.log(`${LOG} checking ${enrollments.length} thread(s)...`);

    // Contacts whose email activity moved this run, refreshed at the end so the
    // CRM tables show the reply before the next engagement sweep.
    const touchedPersonIds = new Set<string>();

    for (const enrollment of enrollments) {
      if (!enrollment.gmailThreadId) continue;

      const thread = await getThreadMessages(
        enrollment.senderEmail,
        enrollment.gmailThreadId
      );

      summary.threadsChecked += 1;

      if (!thread.data) {
        summary.errors.push(`${enrollment.id}: ${thread.error}`);
        continue;
      }

      const lastSentAt = enrollment.messages[0]?.sentAt ?? null;
      const lastMessageId = enrollment.messages[0]?.id ?? null;

      const inbound = thread.data.filter(
        (message) =>
          !message.isFromSender &&
          (!lastSentAt ||
            !message.internalDate ||
            message.internalDate.getTime() >= lastSentAt.getTime() - 60_000)
      );

      if (inbound.length === 0) continue;

      const bounce = inbound.find((message) =>
        looksLikeBounce(message.fromEmail, message.subject)
      );

      if (bounce) {
        console.log(
          `${LOG} enrollment ${enrollment.id} bounced (from ${bounce.fromEmail})`
        );

        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: "BOUNCED",
            stoppedReason: `Bounced: ${bounce.subject ?? "delivery failure"}`,
            nextSendAt: null,
          },
        });

        if (lastMessageId) {
          await prisma.sequenceMessage.update({
            where: { id: lastMessageId },
            data: { bouncedAt: bounce.internalDate ?? new Date() },
          });
        }

        if (enrollment.person.email) {
          await addSuppression(
            enrollment.person.email,
            "bounced",
            bounce.subject ?? undefined
          );
        }

        await logCrmActivity({
          type: "EMAIL_BOUNCED",
          title: `Email from ${enrollment.sequence.name} bounced`,
          body: bounce.subject,
          personId: enrollment.personId,
          companyId: enrollment.person.companyId,
          occurredAt: bounce.internalDate ?? new Date(),
          payload: {
            sequenceId: enrollment.sequence.id,
            gmailMessageId: bounce.id,
          },
          externalId: `sequence-bounce:${bounce.id}`,
        });

        summary.bounces += 1;
        continue;
      }

      // A genuine reply from the contact (or anyone at their company)
      const reply = inbound[0];
      const repliedAt = reply.internalDate ?? new Date();

      console.log(
        `${LOG} enrollment ${enrollment.id} got a reply from ${reply.fromEmail}`
      );

      await prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "REPLIED",
          stoppedReason: `Replied on ${repliedAt.toISOString()}`,
          nextSendAt: null,
        },
      });

      if (lastMessageId) {
        await prisma.sequenceMessage.update({
          where: { id: lastMessageId },
          data: { repliedAt },
        });
      }

      await logCrmActivity({
        type: "EMAIL_REPLIED",
        title: `Replied to ${enrollment.sequence.name}`,
        body: reply.snippet,
        personId: enrollment.personId,
        companyId: enrollment.person.companyId,
        occurredAt: repliedAt,
        payload: {
          sequenceId: enrollment.sequence.id,
          gmailMessageId: reply.id,
        },
        externalId: `sequence-reply:${reply.id}`,
      });

      touchedPersonIds.add(enrollment.personId);
      summary.replies += 1;
    }

    if (touchedPersonIds.size > 0) {
      console.log(
        `${LOG} refreshing engagement for ${touchedPersonIds.size} contact(s)...`
      );
      const engagement = await recomputeEngagementForPeople([
        ...touchedPersonIds,
      ]);
      if (engagement.error) {
        summary.errors.push(`Engagement refresh: ${engagement.error}`);
      }
    }

    console.log(
      `${LOG} checked ${summary.threadsChecked} thread(s): ${summary.replies} replies, ${summary.bounces} bounces`
    );

    return { data: summary, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} sync failed:`, message);
    return { data: null, error: message };
  }
}

interface Booking {
  at: Date;
  title: string;
}

/**
 * Stops active enrollments for contacts who now have a meeting with us, for
 * sequences configured to exit on a booking.
 *
 * The signal is the calendar rather than the recording: every CalendarEvent row
 * is synced from a workspace calendar, so a contact appearing on one means a
 * meeting with the team is on the books. Recorded meetings are still checked so
 * ad-hoc calls that never had a calendar invite also end the sequence.
 */
export async function stopEnrollmentsWithBookedMeetings(): Promise<{
  data: { stopped: number } | null;
  error: string | null;
}> {
  try {
    console.log(`${LOG} checking for contacts with a meeting on a calendar...`);

    const enrollments = await prisma.sequenceEnrollment.findMany({
      where: {
        status: "ACTIVE",
        sequence: { stopOnMeetingBooked: true },
      },
      select: {
        id: true,
        createdAt: true,
        personId: true,
        person: { select: { email: true, companyId: true } },
        sequence: { select: { id: true, name: true } },
      },
      take: 200,
    });

    if (enrollments.length === 0) {
      return { data: { stopped: 0 }, error: null };
    }

    const earliestEnrolledAt = enrollments.reduce(
      (earliest, enrollment) =>
        enrollment.createdAt < earliest ? enrollment.createdAt : earliest,
      enrollments[0].createdAt
    );

    const [events, meetings] = await Promise.all([
      prisma.calendarEvent.findMany({
        where: { startTime: { gte: earliestEnrolledAt } },
        orderBy: { startTime: "asc" },
        select: {
          startTime: true,
          title: true,
          attendees: true,
          organizer: true,
          status: true,
        },
      }),
      prisma.meeting.findMany({
        where: { startTime: { gte: earliestEnrolledAt } },
        orderBy: { startTime: "asc" },
        select: { startTime: true, title: true, participants: true },
      }),
    ]);

    // Google hands back attendee addresses unnormalised, so everything is keyed
    // lower-cased and matched in memory rather than through an array filter.
    const bookingsByEmail = new Map<string, Booking[]>();

    const addBooking = (email: string | null, booking: Booking): void => {
      if (!email || isJaroDevTeamEmail(email)) return;
      const key = email.toLowerCase().trim();
      if (!key) return;
      const existing = bookingsByEmail.get(key);
      if (existing) existing.push(booking);
      else bookingsByEmail.set(key, [booking]);
    };

    for (const event of events) {
      if (event.status === "cancelled") continue;
      const booking: Booking = {
        at: event.startTime,
        title: event.title ?? "Untitled event",
      };
      for (const attendee of [...event.attendees, event.organizer]) {
        addBooking(attendee, booking);
      }
    }

    for (const meeting of meetings) {
      const booking: Booking = { at: meeting.startTime, title: meeting.title };
      for (const participant of meeting.participants) {
        addBooking(participant, booking);
      }
    }

    let stopped = 0;

    for (const enrollment of enrollments) {
      const email = enrollment.person.email?.toLowerCase().trim();
      if (!email) continue;

      const [booking] = (bookingsByEmail.get(email) ?? [])
        .filter((candidate) => candidate.at >= enrollment.createdAt)
        .sort((a, b) => a.at.getTime() - b.at.getTime());

      if (!booking) continue;

      await prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "STOPPED",
          stoppedReason: `Meeting booked: ${booking.title}`,
          nextSendAt: null,
        },
      });

      await logCrmActivity({
        type: "SEQUENCE_STOPPED",
        title: `${enrollment.sequence.name} stopped after a meeting was booked`,
        body: booking.title,
        personId: enrollment.personId,
        companyId: enrollment.person.companyId,
        payload: {
          sequenceId: enrollment.sequence.id,
          enrollmentId: enrollment.id,
          bookedFor: booking.at.toISOString(),
        },
        externalId: `sequence-stopped:${enrollment.id}`,
      });

      stopped += 1;
    }

    if (stopped > 0) {
      console.log(`${LOG} stopped ${stopped} enrollment(s) after a booking`);
    }

    return { data: { stopped }, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} booking check failed:`, message);
    return { data: null, error: message };
  }
}
