import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { StudioBugReportClient } from "./client";
import { JARO_DEV_INTERNAL_CLIENT_ID } from "@/lib/constants";

export default async function StudioBugReportPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    redirect("/");
  }

  // Only clients can access this page
  if (user.role === "ADMIN") {
    redirect("/dashboard");
  }

  // Fetch only bug requests created by this user for Jaro.dev Internal
  const bugRequests = await prisma.request.findMany({
    where: {
      clientCompanyId: JARO_DEV_INTERNAL_CLIENT_ID,
      type: "BUG",
      createdById: user.id,
    },
    include: {
      clientCompany: {
        select: {
          id: true,
          name: true,
        },
      },
      task: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
    orderBy: [
      { status: "asc" },
      { priority: "desc" },
      { createdAt: "desc" },
    ],
  });

  return (
    <StudioBugReportClient
      requests={bugRequests}
      clientCompanyId={JARO_DEV_INTERNAL_CLIENT_ID}
      clientCompanyName="Jaro.dev Internal"
    />
  );
}
