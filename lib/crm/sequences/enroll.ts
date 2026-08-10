import prisma from "@/lib/prisma";
import { logCrmActivity } from "@/lib/crm/activity";
import { checkSendEligibility } from "@/lib/crm/sequences/suppression";
import {
  computeNextSendAt,
  toSendWindow,
} from "@/lib/crm/sequences/schedule";

const LOG = "[Sequence Enroll]";

export interface EnrollResult {
  enrollmentId: string;
  status: "enrolled" | "already_enrolled" | "skipped";
  reason: string | null;
}

/**
 * Enrolls a contact, scheduling the first step inside the sequence's send
 * window. Re-enrolling someone already in the sequence is a no-op so callers,
 * including form processing, can fire without checking first.
 */
export async function enrollPerson(
  sequenceId: string,
  personId: string
): Promise<{ data: EnrollResult | null; error: string | null }> {
  try {
    const sequence = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      include: { steps: { orderBy: { order: "asc" }, take: 1 } },
    });

    if (!sequence) return { data: null, error: "Sequence not found" };

    const firstStep = sequence.steps[0];
    if (!firstStep) {
      return { data: null, error: "Sequence has no steps" };
    }

    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { id: true, email: true, companyId: true },
    });

    if (!person) return { data: null, error: "Contact not found" };
    if (!person.email) {
      return { data: null, error: "Contact has no email address" };
    }

    const existing = await prisma.sequenceEnrollment.findUnique({
      where: { sequenceId_personId: { sequenceId, personId } },
      select: { id: true, status: true },
    });

    if (existing) {
      console.log(
        `${LOG} ${person.email} is already enrolled in "${sequence.name}" (${existing.status})`
      );
      return {
        data: {
          enrollmentId: existing.id,
          status: "already_enrolled",
          reason: existing.status,
        },
        error: null,
      };
    }

    const eligibility = await checkSendEligibility(person.email);
    if (!eligibility.canSend) {
      console.log(`${LOG} not enrolling ${person.email}: ${eligibility.reason}`);
      return {
        data: {
          enrollmentId: "",
          status: "skipped",
          reason: eligibility.reason,
        },
        error: null,
      };
    }

    const nextSendAt = computeNextSendAt(
      new Date(),
      firstStep,
      toSendWindow(sequence)
    );

    console.log(
      `${LOG} enrolling ${person.email} in "${sequence.name}", first send ${nextSendAt.toISOString()}`
    );

    const enrollment = await prisma.sequenceEnrollment.create({
      data: {
        sequenceId,
        personId,
        senderEmail: sequence.senderEmail,
        nextSendAt,
      },
      select: { id: true },
    });

    await logCrmActivity({
      type: "SEQUENCE_ENROLLED",
      title: `Enrolled in ${sequence.name}`,
      personId,
      companyId: person.companyId,
      payload: { sequenceId, enrollmentId: enrollment.id },
      externalId: `sequence-enrollment:${enrollment.id}`,
    });

    return {
      data: { enrollmentId: enrollment.id, status: "enrolled", reason: null },
      error: null,
    };
  } catch (error) {
    console.error(`${LOG} failed to enroll ${personId}:`, error);
    return { data: null, error: "Failed to enroll contact" };
  }
}

export async function enrollPeople(
  sequenceId: string,
  personIds: string[]
): Promise<{
  data: { enrolled: number; skipped: number; alreadyEnrolled: number } | null;
  error: string | null;
}> {
  try {
    let enrolled = 0;
    let skipped = 0;
    let alreadyEnrolled = 0;

    for (const personId of personIds) {
      const result = await enrollPerson(sequenceId, personId);
      if (!result.data) {
        skipped += 1;
        continue;
      }
      if (result.data.status === "enrolled") enrolled += 1;
      else if (result.data.status === "already_enrolled") alreadyEnrolled += 1;
      else skipped += 1;
    }

    console.log(
      `${LOG} bulk enroll finished: ${enrolled} enrolled, ${alreadyEnrolled} already in, ${skipped} skipped`
    );

    return { data: { enrolled, skipped, alreadyEnrolled }, error: null };
  } catch (error) {
    console.error(`${LOG} bulk enroll failed:`, error);
    return { data: null, error: "Failed to enroll contacts" };
  }
}
