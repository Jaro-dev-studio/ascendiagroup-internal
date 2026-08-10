import prisma from "@/lib/prisma";
import { createCronRoute } from "@/lib/cron/route-handler";

// Vercel cron: max 300 seconds execution time
export const maxDuration = 300;

const LOG = "[Cron: process-recurring-tasks]";

/**
 * Check if a recurring task should create a task today
 */
function shouldCreateTaskToday(
  frequency: string,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  lastCreatedAt: Date | null,
  now: Date
): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // If already created today, skip
  if (lastCreatedAt) {
    const lastCreatedDate = new Date(
      lastCreatedAt.getFullYear(),
      lastCreatedAt.getMonth(),
      lastCreatedAt.getDate()
    );
    if (lastCreatedDate.getTime() === today.getTime()) {
      return false;
    }
  }

  const currentDayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const currentDayOfMonth = now.getDate(); // 1-31

  switch (frequency) {
    case "DAILY":
      return true;

    case "WEEKLY":
      // dayOfWeek: 0 = Sunday, 6 = Saturday
      return dayOfWeek !== null && currentDayOfWeek === dayOfWeek;

    case "MONTHLY":
      // dayOfMonth: 1-31
      return dayOfMonth !== null && currentDayOfMonth === dayOfMonth;

    default:
      return false;
  }
}

export const GET = createCronRoute("process-recurring-tasks", async () => {
  const now = new Date();

  console.log(`${LOG} fetching active recurring tasks...`);

  const recurringTasks = await prisma.recurringTask.findMany({
    where: {
      isActive: true,
    },
    include: {
      clientCompany: {
        select: {
          id: true,
          name: true,
        },
      },
      assignee: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  console.log(`${LOG} found ${recurringTasks.length} active recurring task(s)`);

  const results = {
    total: recurringTasks.length,
    processed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  console.log(`${LOG} processing recurring tasks...`);

  for (const recurringTask of recurringTasks) {
    try {
      const shouldCreate = shouldCreateTaskToday(
        recurringTask.frequency,
        recurringTask.dayOfWeek,
        recurringTask.dayOfMonth,
        recurringTask.lastCreatedAt,
        now
      );

      if (!shouldCreate) {
        results.skipped++;
        continue;
      }

      console.log(
        `${LOG} creating task for "${recurringTask.name}" (${recurringTask.frequency})`
      );

      const task = await prisma.task.create({
        data: {
          name: recurringTask.name,
          description: recurringTask.description,
          priority: recurringTask.priority,
          status: "TODO",
          clientCompanyId: recurringTask.clientCompanyId,
          assigneeId: recurringTask.assigneeId,
          createdByJaroDevAutomation: true,
        },
      });

      await prisma.recurringTask.update({
        where: { id: recurringTask.id },
        data: { lastCreatedAt: now },
      });

      console.log(`${LOG} created task ${task.id}`);
      results.processed++;
    } catch (error) {
      const errorMsg = `${recurringTask.name} (${recurringTask.id}): ${error instanceof Error ? error.message : "Unknown error"}`;
      console.error(`${LOG} ERROR: ${errorMsg}`);
      results.errors.push(errorMsg);
    }
  }

  console.log(
    `${LOG} summary: ${results.processed} created, ${results.skipped} skipped, ${results.errors.length} errors`
  );

  return { data: results, error: null, failures: results.errors };
});
