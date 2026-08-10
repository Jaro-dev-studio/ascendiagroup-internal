import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { getUpcomingCallsSummary } from "@/lib/fetchers";
import { OverviewClient } from "./client";

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Fetch all data in parallel
  const [
    clientCompanies,
    tasks,
    actionItems,
    requests,
    formSubmissions,
    upcomingCallsResult,
  ] = await Promise.all([
    // Client companies with status counts
    prisma.company.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    }),
    // All tasks for blocked task tracking
    prisma.task.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        updatedAt: true,
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      where: {
        status: {
          not: "DONE",
        },
      },
    }),
    // All action items for pending tracking
    prisma.actionItem.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      where: {
        status: {
          not: "DONE",
        },
      },
    }),
    // All requests for pending tracking
    prisma.request.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        type: true,
        priority: true,
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      where: {
        status: "SUBMITTED",
      },
    }),
    // Form submissions for counts by period
    prisma.embedFormSubmission.findMany({
      select: {
        id: true,
        createdAt: true,
        name: true,
        email: true,
        type: true,
        utmSource: true,
        utmCampaign: true,
        utmContent: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    // Upcoming calls summary from Calendly
    getUpcomingCallsSummary(),
  ]);

  return (
    <OverviewClient
      clientCompanies={clientCompanies}
      tasks={tasks}
      actionItems={actionItems}
      requests={requests}
      formSubmissions={formSubmissions}
      upcomingCalls={upcomingCallsResult.data}
    />
  );
}
