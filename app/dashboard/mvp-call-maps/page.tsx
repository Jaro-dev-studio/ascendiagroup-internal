import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getMVPCallMaps, getClientCompanies, getFormSubmissionsForLinking } from "@/lib/fetchers";
import prisma from "@/lib/prisma";
import { MVPCallMapsClient } from "./client";

export default async function MVPCallMapsPage() {
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

  const [mvpCallMapsResult, clientsResult, submissionsResult] = await Promise.all([
    getMVPCallMaps(),
    getClientCompanies(),
    getFormSubmissionsForLinking(),
  ]);

  if (mvpCallMapsResult.error) {
    throw new Error(mvpCallMapsResult.error);
  }

  return (
    <MVPCallMapsClient
      mvpCallMaps={mvpCallMapsResult.data || []}
      clients={clientsResult.data || []}
      formSubmissions={submissionsResult.data || []}
    />
  );
}
