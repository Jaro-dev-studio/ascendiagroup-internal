import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getScheduledSalesCalls } from "@/lib/fetchers";
import { LiveFunnelClient } from "./client";

export default async function LiveFunnelPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  // Fetch all data in parallel
  const [attendedSalesCallClients, formSubmissions, scheduledCallsResult] = await Promise.all([
    // Client companies with ATTENDED_SALES_CALL status for calculating attendance
    prisma.company.findMany({
      where: {
        status: "ATTENDED_SALES_CALL",
      },
      select: {
        id: true,
        createdAt: true,
      },
    }),
    // Form submissions for counting unique leads
    prisma.embedFormSubmission.findMany({
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    // Scheduled sales calls from Calendly
    getScheduledSalesCalls(),
  ]);

  return (
    <LiveFunnelClient
      attendedSalesCallClients={attendedSalesCallClients}
      formSubmissions={formSubmissions}
      scheduledSalesCalls={scheduledCallsResult.data || []}
    />
  );
}
