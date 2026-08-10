import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { FeatureRequestsClient } from "./client";
import { AdminRequestsClient } from "./admin-client";
import { getRequests, getRequestsByClientCompany, getTasks, getActionItems, getAssignableUsers } from "@/lib/fetchers";

export default async function FeatureRequestsPage() {
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

  // Admin/Developer view: Show all requests
  if (user.role === "ADMIN" || user.role === "DEVELOPER") {
    const [requestsResult, clientCompanies, usersResult, tasksResult, actionItemsResult] = await Promise.all([
      getRequests(),
      prisma.company.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      getAssignableUsers(),
      getTasks(),
      getActionItems(),
    ]);

    const requests = requestsResult.data || [];
    const users = usersResult.data || [];
    const tasks = (tasksResult.data || []).map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      clientCompany: t.clientCompany,
    }));
    const actionItems = (actionItemsResult.data || []).map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      clientCompany: a.clientCompany,
    }));

    return (
      <AdminRequestsClient
        requests={requests}
        clientCompanies={clientCompanies}
        users={users}
        tasks={tasks}
        actionItems={actionItems}
      />
    );
  }

  // Client view: Show only their company's feature requests
  if (!user.clientCompanyId) {
    redirect("/dashboard");
  }

  const requestsResult = await getRequestsByClientCompany(user.clientCompanyId);
  const featureRequests = (requestsResult.data || []).filter((r) => r.type === "FEATURE");

  return (
    <FeatureRequestsClient
      requests={featureRequests}
      clientCompanyId={user.clientCompanyId}
      clientCompanyName={user.clientCompany?.name || ""}
    />
  );
}
