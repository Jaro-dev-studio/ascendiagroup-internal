import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getDemosWithClientInfo, getClientCompaniesWithoutDemos } from "@/lib/fetchers";
import prisma from "@/lib/prisma";
import { DemosClient } from "./client";

export const maxDuration = 300;

export default async function DemosPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  const isAdmin = user?.role === "ADMIN";

  const [demosResult, clientsResult] = await Promise.all([
    getDemosWithClientInfo(),
    isAdmin ? getClientCompaniesWithoutDemos() : Promise.resolve({ data: [], error: null }),
  ]);

  if (demosResult.error) {
    throw new Error(demosResult.error);
  }

  return (
    <DemosClient
      demos={demosResult.data || []}
      clientCompaniesWithoutDemos={clientsResult.data || []}
      isAdmin={isAdmin}
    />
  );
}
