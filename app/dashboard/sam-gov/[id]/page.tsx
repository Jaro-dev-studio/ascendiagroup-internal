import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getGovContract } from "@/lib/fetchers";
import { GovContractDetailClient } from "./client";

export default async function GovContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  const { data: contract, error } = await getGovContract(id);

  if (error || !contract) {
    redirect("/dashboard/sam-gov");
  }

  return <GovContractDetailClient contract={contract} />;
}
