"use server";

import { revalidatePath } from "next/cache";
import type { StrategyStatus, TaskPriority } from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";
import { generateStrategy } from "@/lib/ai/strategy";
import { addDays } from "@/lib/utils";

export async function generateStrategyAction(input: {
  clientId: string;
  submissionId?: string;
  meetingIds: string[];
  extraContext?: string;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const user = await requireStaff();
    console.log(`[Strategy] generation requested for client ${input.clientId}`);

    const strategy = await generateStrategy({
      clientId: input.clientId,
      submissionId: input.submissionId,
      meetingIds: input.meetingIds,
      createdById: user.id,
      extraContext: input.extraContext,
    });

    revalidatePath("/dashboard/strategies");
    revalidatePath(`/dashboard/clients/${input.clientId}`);
    return { data: { id: strategy.id }, error: null };
  } catch (error) {
    console.error("[Strategy] generation failed", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Could not generate the strategy.",
    };
  }
}

export async function updateStrategy(
  id: string,
  input: {
    title: string;
    summary?: string;
    positioning?: string;
    audience?: string;
    risks?: string;
    status: string;
  }
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();

    await prisma.strategy.update({
      where: { id },
      data: {
        title: input.title.trim(),
        summary: input.summary || null,
        positioning: input.positioning || null,
        audience: input.audience || null,
        risks: input.risks || null,
        status: input.status as StrategyStatus,
        approvedAt: input.status === "APPROVED" ? new Date() : null,
      },
    });

    revalidatePath(`/dashboard/strategies/${id}`);
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Strategy] failed to update strategy", error);
    return { data: null, error: "Could not save the strategy." };
  }
}

export async function updateStrategyPhase(
  id: string,
  input: { title: string; objective?: string }
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();

    const phase = await prisma.strategyPhase.update({
      where: { id },
      data: { title: input.title.trim(), objective: input.objective || null },
    });

    revalidatePath(`/dashboard/strategies/${phase.strategyId}`);
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Strategy] failed to update phase", error);
    return { data: null, error: "Could not save the phase." };
  }
}

export async function saveStrategyItem(input: {
  phaseId: string;
  itemId?: string;
  title: string;
  description?: string;
  category?: string;
  owner?: string;
  priority: string;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();

    if (input.title.trim().length < 2) {
      return { data: null, error: "Give the action a title." };
    }

    const data = {
      title: input.title.trim(),
      description: input.description || null,
      category: input.category || null,
      owner: input.owner || null,
      priority: input.priority as TaskPriority,
    };

    let itemId = input.itemId;

    if (itemId) {
      await prisma.strategyItem.update({ where: { id: itemId }, data });
    } else {
      const order = await prisma.strategyItem.count({
        where: { phaseId: input.phaseId },
      });
      const created = await prisma.strategyItem.create({
        data: { ...data, phaseId: input.phaseId, order },
      });
      itemId = created.id;
    }

    const phase = await prisma.strategyPhase.findUnique({
      where: { id: input.phaseId },
      select: { strategyId: true },
    });
    if (phase) revalidatePath(`/dashboard/strategies/${phase.strategyId}`);

    return { data: { id: itemId }, error: null };
  } catch (error) {
    console.error("[Strategy] failed to save item", error);
    return { data: null, error: "Could not save the action." };
  }
}

export async function deleteStrategyItem(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();

    const item = await prisma.strategyItem.delete({
      where: { id },
      include: { phase: { select: { strategyId: true } } },
    });

    revalidatePath(`/dashboard/strategies/${item.phase.strategyId}`);
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Strategy] failed to delete item", error);
    return { data: null, error: "Could not delete the action." };
  }
}

const PHASE_OFFSETS: Record<string, number> = {
  DAY_30: 30,
  DAY_60: 60,
  DAY_90: 90,
};

/** Pushes every not-yet-linked strategy action onto the client delivery board. */
export async function pushStrategyToBoard(
  strategyId: string,
  projectId?: string
): Promise<{ data: { created: number; projectId: string } | null; error: string | null }> {
  try {
    const user = await requireStaff();
    console.log(`[Strategy] pushing strategy ${strategyId} to the board...`);

    const strategy = await prisma.strategy.findUnique({
      where: { id: strategyId },
      include: {
        client: true,
        phases: {
          orderBy: { order: "asc" },
          include: { items: { orderBy: { order: "asc" } } },
        },
      },
    });

    if (!strategy) return { data: null, error: "Strategy not found." };

    let targetProjectId = projectId || strategy.projectId;

    if (!targetProjectId) {
      const existing = await prisma.project.findFirst({
        where: { clientId: strategy.clientId, status: { not: "COMPLETED" } },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        targetProjectId = existing.id;
      } else {
        const created = await prisma.project.create({
          data: {
            clientId: strategy.clientId,
            name: `${strategy.client.name} — 90 day delivery`,
            description: `Created from the strategy "${strategy.title}".`,
            status: "ACTIVE",
            startDate: new Date(),
            dueDate: addDays(new Date(), 90),
            ownerId: user.id,
          },
        });
        targetProjectId = created.id;
      }
    }

    let created = 0;
    for (const phase of strategy.phases) {
      for (const item of phase.items) {
        if (item.taskId) continue;

        const task = await prisma.task.create({
          data: {
            projectId: targetProjectId,
            clientId: strategy.clientId,
            title: item.title,
            description: [item.description, item.category ? `Lane: ${item.category}` : null]
              .filter(Boolean)
              .join("\n\n"),
            priority: item.priority,
            dueDate: addDays(new Date(), PHASE_OFFSETS[phase.phase] ?? 30),
            source: "STRATEGY",
            sourceRef: strategy.id,
            position: created,
          },
        });

        await prisma.strategyItem.update({
          where: { id: item.id },
          data: { taskId: task.id },
        });
        created += 1;
      }
    }

    await prisma.strategy.update({
      where: { id: strategyId },
      data: { projectId: targetProjectId },
    });

    console.log(`[Strategy] created ${created} tasks from the roadmap`);

    revalidatePath(`/dashboard/strategies/${strategyId}`);
    revalidatePath(`/dashboard/projects/${targetProjectId}`);
    revalidatePath("/dashboard/tasks");

    return { data: { created, projectId: targetProjectId }, error: null };
  } catch (error) {
    console.error("[Strategy] failed to push to board", error);
    return { data: null, error: "Could not push the roadmap to the board." };
  }
}

export async function deleteStrategy(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    await prisma.strategy.delete({ where: { id } });
    revalidatePath("/dashboard/strategies");
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Strategy] failed to delete strategy", error);
    return { data: null, error: "Could not delete the strategy." };
  }
}
