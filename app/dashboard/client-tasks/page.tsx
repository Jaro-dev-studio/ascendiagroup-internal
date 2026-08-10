import { Suspense } from "react";
import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getTasksByClientCompany } from "@/lib/fetchers";
import { getTaskViews } from "@/lib/actions";
import { ClientTasksClient } from "./client";

export default async function ClientTasksPage() {
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

  if (!user || user.role !== "CLIENT") {
    redirect("/dashboard");
  }

  if (!user.clientCompany) {
    redirect("/dashboard");
  }

  const [tasksResult, viewsResult] = await Promise.all([
    getTasksByClientCompany(user.clientCompany.id),
    getTaskViews(),
  ]);

  return (
    <Suspense fallback={null}>
      <ClientTasksClient
        clientCompanyName={user.clientCompany.name}
        tasks={tasksResult.data || []}
        savedViews={viewsResult.data || []}
      />
    </Suspense>
  );
}
