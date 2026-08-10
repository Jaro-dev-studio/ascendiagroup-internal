import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { getActionItems, getActionItemsByClientCompany, getClientCompanies } from "@/lib/fetchers";
import { getActionItemViews } from "@/lib/actions";
import { ActionItemsClient } from "./client";
import { ActionItemsClientView } from "./client-view";
import { JARO_DEV_INTERNAL_CLIENT_ID } from "@/lib/constants";

export default async function ActionItemsPage() {
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

  // Admin/Developer view - full CRUD for Admin, create-only for Developer
  if (user.role === "ADMIN" || user.role === "DEVELOPER") {
    const [actionItemsResult, clientCompaniesResult, actionItemViewsResult] = await Promise.all([
      getActionItems(),
      getClientCompanies(),
      getActionItemViews(),
    ]);

    // Filter data for developers - exclude Jaro.dev Internal client data
    const isAdmin = user.role === "ADMIN";
    const actionItems = isAdmin
      ? actionItemsResult.data || []
      : (actionItemsResult.data || []).filter(item => item.clientCompanyId !== JARO_DEV_INTERNAL_CLIENT_ID);
    const clientCompanies = isAdmin
      ? clientCompaniesResult.data || []
      : (clientCompaniesResult.data || []).filter(c => c.id !== JARO_DEV_INTERNAL_CLIENT_ID);

    return (
      <Suspense fallback={null}>
        <ActionItemsClient
          actionItems={actionItems}
          clientCompanies={clientCompanies}
          userRole={user.role as "ADMIN" | "DEVELOPER"}
          savedViews={actionItemViewsResult.data || []}
        />
      </Suspense>
    );
  }

  // Client view - read-only, filtered by their company
  if (user.role === "CLIENT" && user.clientCompany) {
    const actionItemsResult = await getActionItemsByClientCompany(user.clientCompany.id);

    return (
      <ActionItemsClientView
        actionItems={actionItemsResult.data || []}
      />
    );
  }

  // No access
  redirect("/dashboard");
}
