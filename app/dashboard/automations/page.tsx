import { requireStaff } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

import { AutomationsClient } from "./client";

export const metadata = { title: "Automations" };

export default async function AutomationsPage() {
  await requireStaff();

  const [templates, rules] = await Promise.all([
    prisma.taskTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { order: "asc" } } },
    }),
    prisma.automationRule.findMany({
      orderBy: { createdAt: "desc" },
      include: { template: { select: { id: true, name: true } } },
    }),
  ]);

  return <AutomationsClient templates={templates} rules={rules} />;
}
