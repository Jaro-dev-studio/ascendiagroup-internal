import prisma from "@/lib/prisma";
import { isJaroDevTeamEmail } from "@/lib/constants";

const LOG = "[Suppression]";

export type SuppressionReason =
  | "unsubscribed"
  | "bounced"
  | "complained"
  | "manual";

export interface SendEligibility {
  canSend: boolean;
  reason: string | null;
}

/**
 * Single gate every outbound sequence send passes through: the global
 * suppression list, the contact's own do-not-contact flag, and a guard against
 * mailing our own team.
 */
export async function checkSendEligibility(
  email: string
): Promise<SendEligibility> {
  const normalised = email.toLowerCase().trim();

  if (!normalised || !normalised.includes("@")) {
    return { canSend: false, reason: "Invalid email address" };
  }

  if (isJaroDevTeamEmail(normalised)) {
    return { canSend: false, reason: "Internal team address" };
  }

  const [suppression, person] = await Promise.all([
    prisma.suppression.findUnique({
      where: { email: normalised },
      select: { reason: true },
    }),
    prisma.person.findUnique({
      where: { email: normalised },
      select: { doNotContact: true },
    }),
  ]);

  if (suppression) {
    return { canSend: false, reason: `Suppressed (${suppression.reason})` };
  }

  if (person?.doNotContact) {
    return { canSend: false, reason: "Contact is marked do not contact" };
  }

  return { canSend: true, reason: null };
}

export async function addSuppression(
  email: string,
  reason: SuppressionReason,
  note?: string
): Promise<{ data: { email: string } | null; error: string | null }> {
  try {
    const normalised = email.toLowerCase().trim();
    console.log(`${LOG} suppressing ${normalised} (${reason})...`);

    await prisma.suppression.upsert({
      where: { email: normalised },
      update: { reason, note: note ?? null },
      create: { email: normalised, reason, note: note ?? null },
    });

    // Keep the CRM record consistent so the UI reflects the suppression too
    await prisma.person.updateMany({
      where: { email: normalised },
      data: { doNotContact: true },
    });

    return { data: { email: normalised }, error: null };
  } catch (error) {
    console.error(`${LOG} failed to suppress ${email}:`, error);
    return { data: null, error: "Failed to add suppression" };
  }
}

export async function removeSuppression(
  email: string
): Promise<{ data: { email: string } | null; error: string | null }> {
  try {
    const normalised = email.toLowerCase().trim();

    await prisma.suppression.deleteMany({ where: { email: normalised } });
    await prisma.person.updateMany({
      where: { email: normalised },
      data: { doNotContact: false },
    });

    return { data: { email: normalised }, error: null };
  } catch (error) {
    console.error(`${LOG} failed to unsuppress ${email}:`, error);
    return { data: null, error: "Failed to remove suppression" };
  }
}
