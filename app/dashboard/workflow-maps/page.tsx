import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getWorkflows } from "@/lib/fetchers/workflows";
import prisma from "@/lib/prisma";
import { WorkflowMapsClient } from "./client";

export default async function WorkflowMapsPage() {
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

  const workflowsResult = await getWorkflows();

  if (workflowsResult.error) {
    throw new Error(workflowsResult.error);
  }

  return <WorkflowMapsClient workflows={workflowsResult.data || []} />;
}
