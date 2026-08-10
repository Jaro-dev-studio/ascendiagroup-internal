"use server";

import { revalidatePath } from "next/cache";
import type {
  AutomationTrigger,
  ServiceLine,
  TaskPriority,
} from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";
import { addDays } from "@/lib/utils";

export async function saveTaskTemplate(input: {
  id?: string;
  name: string;
  description?: string;
  service?: string;
  items: {
    title: string;
    description?: string;
    offsetDays: number;
    priority: string;
  }[];
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    console.log(`[Automations] saving task template "${input.name}"...`);

    if (input.name.trim().length < 2) {
      return { data: null, error: "Give the template a name." };
    }
    const items = input.items.filter((item) => item.title.trim().length > 1);
    if (items.length === 0) {
      return { data: null, error: "Add at least one task to the template." };
    }

    const data = {
      name: input.name.trim(),
      description: input.description || null,
      service: input.service ? (input.service as ServiceLine) : null,
    };

    const itemData = items.map((item, index) => ({
      title: item.title.trim(),
      description: item.description || null,
      offsetDays: Number.isFinite(item.offsetDays) ? item.offsetDays : 0,
      priority: item.priority as TaskPriority,
      order: index,
    }));

    let templateId = input.id;

    if (templateId) {
      await prisma.$transaction([
        prisma.taskTemplateItem.deleteMany({ where: { templateId } }),
        prisma.taskTemplate.update({
          where: { id: templateId },
          data: { ...data, items: { create: itemData } },
        }),
      ]);
    } else {
      const created = await prisma.taskTemplate.create({
        data: { ...data, items: { create: itemData } },
      });
      templateId = created.id;
    }

    revalidatePath("/dashboard/automations");
    return { data: { id: templateId }, error: null };
  } catch (error) {
    console.error("[Automations] failed to save template", error);
    return { data: null, error: "Could not save the template." };
  }
}

export async function deleteTaskTemplate(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    await prisma.taskTemplate.delete({ where: { id } });
    revalidatePath("/dashboard/automations");
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Automations] failed to delete template", error);
    return { data: null, error: "Could not delete the template." };
  }
}

export async function saveAutomationRule(input: {
  id?: string;
  name: string;
  trigger: string;
  templateId: string;
  isActive: boolean;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    console.log(`[Automations] saving rule "${input.name}"...`);

    if (input.name.trim().length < 2) {
      return { data: null, error: "Give the rule a name." };
    }
    if (!input.templateId) {
      return { data: null, error: "Choose the task template to apply." };
    }

    const data = {
      name: input.name.trim(),
      trigger: input.trigger as AutomationTrigger,
      templateId: input.templateId,
      isActive: input.isActive,
    };

    let ruleId = input.id;

    if (ruleId) {
      await prisma.automationRule.update({ where: { id: ruleId }, data });
    } else {
      const created = await prisma.automationRule.create({ data });
      ruleId = created.id;
    }

    revalidatePath("/dashboard/automations");
    return { data: { id: ruleId }, error: null };
  } catch (error) {
    console.error("[Automations] failed to save rule", error);
    return { data: null, error: "Could not save the rule." };
  }
}

export async function deleteAutomationRule(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    await prisma.automationRule.delete({ where: { id } });
    revalidatePath("/dashboard/automations");
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Automations] failed to delete rule", error);
    return { data: null, error: "Could not delete the rule." };
  }
}

/** Runs a recurring rule now against every active client. */
export async function runAutomationRule(
  id: string
): Promise<{ data: { created: number } | null; error: string | null }> {
  try {
    const user = await requireStaff();
    console.log(`[Automations] running rule ${id}...`);

    const rule = await prisma.automationRule.findUnique({
      where: { id },
      include: { template: { include: { items: { orderBy: { order: "asc" } } } } },
    });

    if (!rule?.template) {
      return { data: null, error: "This rule has no task template attached." };
    }
    if (rule.trigger === "ONBOARDING_SUBMITTED") {
      return {
        data: null,
        error: "Intake rules run automatically when a submission is processed.",
      };
    }

    const clients = await prisma.client.findMany({
      where: {
        status: "ACTIVE",
        ...(rule.template.service
          ? { services: { some: { service: rule.template.service } } }
          : {}),
      },
      include: {
        projects: {
          where: { status: { not: "COMPLETED" } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (clients.length === 0) {
      return {
        data: null,
        error: "No active clients match this template's service line.",
      };
    }

    let created = 0;

    for (const client of clients) {
      let projectId = client.projects[0]?.id;

      if (!projectId) {
        const project = await prisma.project.create({
          data: {
            clientId: client.id,
            name: `${client.name} — retained delivery`,
            status: "ACTIVE",
            startDate: new Date(),
            ownerId: client.accountManagerId ?? user.id,
          },
        });
        projectId = project.id;
      }

      for (const item of rule.template.items) {
        await prisma.task.create({
          data: {
            projectId,
            clientId: client.id,
            title: item.title,
            description: item.description,
            priority: item.priority,
            dueDate: addDays(new Date(), item.offsetDays),
            assigneeId: client.accountManagerId,
            source: "AUTOMATION",
            sourceRef: rule.id,
            position: created,
          },
        });
        created += 1;
      }
    }

    await prisma.automationRule.update({
      where: { id },
      data: { lastRunAt: new Date(), runCount: { increment: 1 } },
    });

    console.log(`[Automations] rule created ${created} tasks`);

    revalidatePath("/dashboard/automations");
    revalidatePath("/dashboard/tasks");
    return { data: { created }, error: null };
  } catch (error) {
    console.error("[Automations] rule run failed", error);
    return { data: null, error: "Could not run the rule." };
  }
}
