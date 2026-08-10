import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { getTasks, getActionItems, getAssignableUsers } from "@/lib/fetchers";
import { getClientCompanies } from "@/lib/fetchers";
import { getTaskViews } from "@/lib/actions";
import { TasksClient } from "./client";
import { JARO_DEV_INTERNAL_CLIENT_ID } from "@/lib/constants";

export default async function TasksPage() {
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

  const [tasksResult, clientCompaniesResult, usersResult, actionItemsResult, taskViewsResult] = await Promise.all([
    getTasks(),
    getClientCompanies(),
    getAssignableUsers(),
    getActionItems(),
    getTaskViews(),
  ]);

  // Filter data for developers - exclude Jaro.dev Internal client data
  const isAdmin = user.role === "ADMIN";
  const tasks = isAdmin 
    ? tasksResult.data || []
    : (tasksResult.data || []).filter(task => task.clientCompanyId !== JARO_DEV_INTERNAL_CLIENT_ID);
  const clientCompanies = isAdmin
    ? clientCompaniesResult.data || []
    : (clientCompaniesResult.data || []).filter(c => c.id !== JARO_DEV_INTERNAL_CLIENT_ID);
  const actionItems = isAdmin
    ? actionItemsResult.data || []
    : (actionItemsResult.data || []).filter(item => item.clientCompanyId !== JARO_DEV_INTERNAL_CLIENT_ID);

  return (
    <Suspense fallback={null}>
      <TasksClient
        tasks={tasks}
        clientCompanies={clientCompanies}
        users={usersResult.data || []}
        actionItems={actionItems}
        savedViews={taskViewsResult.data || []}
      />
    </Suspense>
  );
}
