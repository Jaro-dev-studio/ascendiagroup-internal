"use server";

import { revalidatePath } from "next/cache";
import type { ReportType } from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";

export async function saveReport(input: {
  id?: string;
  clientId: string;
  title: string;
  type: string;
  periodStart: string;
  periodEnd: string;
  summary?: string;
  highlights: string[];
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    console.log(`[Reporting] saving report "${input.title}"...`);

    if (!input.clientId) return { data: null, error: "Choose a client." };
    if (input.title.trim().length < 2) {
      return { data: null, error: "Give the report a title." };
    }

    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      return { data: null, error: "Enter a valid reporting period." };
    }
    if (periodEnd < periodStart) {
      return { data: null, error: "The period end must be after the start." };
    }

    const data = {
      title: input.title.trim(),
      type: input.type as ReportType,
      periodStart,
      periodEnd,
      summary: input.summary || null,
      highlights: input.highlights.filter(Boolean),
    };

    let reportId = input.id;

    if (reportId) {
      await prisma.report.update({ where: { id: reportId }, data });
    } else {
      const created = await prisma.report.create({
        data: { ...data, clientId: input.clientId },
      });
      reportId = created.id;
    }

    revalidatePath("/dashboard/reporting");
    revalidatePath(`/dashboard/clients/${input.clientId}`);
    return { data: { id: reportId }, error: null };
  } catch (error) {
    console.error("[Reporting] failed to save report", error);
    return { data: null, error: "Could not save the report." };
  }
}

export async function publishReport(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const user = await requireStaff();
    console.log(`[Reporting] publishing report ${id}...`);

    const report = await prisma.report.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        clientId: report.clientId,
        actorId: user.id,
        type: "REPORT_PUBLISHED",
        title: `Report published: ${report.title}`,
      },
    });

    revalidatePath("/dashboard/reporting");
    revalidatePath(`/dashboard/clients/${report.clientId}`);
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Reporting] failed to publish report", error);
    return { data: null, error: "Could not publish the report." };
  }
}

export async function deleteReport(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    await prisma.report.delete({ where: { id } });
    revalidatePath("/dashboard/reporting");
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Reporting] failed to delete report", error);
    return { data: null, error: "Could not delete the report." };
  }
}
