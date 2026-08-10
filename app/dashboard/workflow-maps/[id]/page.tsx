import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { getWorkflow } from "@/lib/fetchers/workflows";
import prisma from "@/lib/prisma";
import { WorkflowDetailClient } from "./client";

interface WorkflowDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function WorkflowDetailPage({
  params,
}: WorkflowDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { id } = await params;

  const workflowResult = await getWorkflow(id);

  if (workflowResult.error) {
    throw new Error(workflowResult.error);
  }

  if (!workflowResult.data) {
    notFound();
  }

  return <WorkflowDetailClient workflow={workflowResult.data} />;
}
