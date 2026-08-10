import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getUpcomingCalls } from "@/lib/fetchers";
import prisma from "@/lib/prisma";
import { UpcomingCallsClient } from "./client";

export default async function UpcomingCallsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  // Check if user is admin
  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { data: upcomingCalls, error } = await getUpcomingCalls();

  if (error) {
    // Don't throw - show empty state with error message
    return <UpcomingCallsClient upcomingCalls={[]} error={error} userEmail={session.user.email} />;
  }

  return <UpcomingCallsClient upcomingCalls={upcomingCalls || []} userEmail={session.user.email} />;
}
