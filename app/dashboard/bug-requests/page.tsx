import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { BugRequestsClient } from "./client";
import { getRequestsByClientCompany } from "@/lib/fetchers";

export default async function BugRequestsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      clientCompany: true,
    },
  });

  if (!user) {
    redirect("/");
  }

  // Admin should use the unified requests page
  if (user.role === "ADMIN") {
    redirect("/dashboard/feature-requests");
  }

  // Client view: Show only their company's bug requests
  if (!user.clientCompanyId) {
    redirect("/dashboard");
  }

  const requestsResult = await getRequestsByClientCompany(user.clientCompanyId);
  const bugRequests = (requestsResult.data || []).filter((r) => r.type === "BUG");

  return (
    <BugRequestsClient
      requests={bugRequests}
      clientCompanyId={user.clientCompanyId}
      clientCompanyName={user.clientCompany?.name || ""}
    />
  );
}
