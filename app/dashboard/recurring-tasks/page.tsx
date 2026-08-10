import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { getRecurringTasks } from "@/lib/fetchers";
import { getClientCompanies, getAssignableUsers } from "@/lib/fetchers";
import { RecurringTasksClient } from "./client";

export default async function RecurringTasksPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || (user.role !== "ADMIN" && user.role !== "DEVELOPER")) {
    redirect("/dashboard");
  }

  const [recurringTasksResult, clientCompaniesResult, usersResult] = await Promise.all([
    getRecurringTasks(),
    getClientCompanies(),
    getAssignableUsers(),
  ]);

  return (
    <Suspense fallback={null}>
      <RecurringTasksClient
        recurringTasks={recurringTasksResult.data || []}
        clientCompanies={clientCompaniesResult.data || []}
        users={usersResult.data || []}
      />
    </Suspense>
  );
}
