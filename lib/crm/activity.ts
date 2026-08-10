import prisma from "@/lib/prisma";
import type { CrmActivityType, Prisma } from "@prisma/client";

interface LogActivityInput {
  type: CrmActivityType;
  title: string;
  body?: string | null;
  payload?: Prisma.InputJsonValue;
  personId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
  meetingId?: string | null;
  actorUserId?: string | null;
  occurredAt?: Date;
  /** Stable key from the source system, so replays do not duplicate entries. */
  externalId?: string | null;
  /**
   * When an externalId already exists, merge these fields instead of leaving
   * the row untouched. Used for meeting RSVP refreshes on the scheduled entry.
   */
  updateOnConflict?: {
    payload?: boolean;
    title?: boolean;
    body?: boolean;
  };
}

/**
 * Appends an entry to the unified CRM timeline. Never throws: a failed timeline
 * write must not break the operation that triggered it.
 */
export async function logCrmActivity(
  input: LogActivityInput
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const data = {
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      payload: input.payload,
      personId: input.personId ?? null,
      companyId: input.companyId ?? null,
      dealId: input.dealId ?? null,
      meetingId: input.meetingId ?? null,
      actorUserId: input.actorUserId ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      externalId: input.externalId ?? null,
    };

    const update: Prisma.CrmActivityUpdateInput = {};
    if (input.updateOnConflict?.payload && input.payload !== undefined) {
      update.payload = input.payload;
    }
    if (input.updateOnConflict?.title) {
      update.title = input.title;
    }
    if (input.updateOnConflict?.body) {
      update.body = input.body ?? null;
    }

    const activity = input.externalId
      ? await prisma.crmActivity.upsert({
        where: { externalId: input.externalId },
        update,
        create: data,
        select: { id: true },
      })
      : await prisma.crmActivity.create({ data, select: { id: true } });

    return { data: activity, error: null };
  } catch (error) {
    console.error("[CRM Activity] Failed to log activity:", error);
    return { data: null, error: "Failed to log activity" };
  }
}
