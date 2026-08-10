import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getSalesCallMaps, getClientCompanies, getMeetings, getFormSubmissionsForLinking } from "@/lib/fetchers";
import prisma from "@/lib/prisma";
import { SalesCallMapsClient } from "./client";

export default async function SalesCallMapsPage() {
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

  const [salesCallMapsResult, clientsResult, meetingsResult, submissionsResult] = await Promise.all([
    getSalesCallMaps(),
    getClientCompanies(),
    getMeetings(),
    getFormSubmissionsForLinking(),
  ]);

  if (salesCallMapsResult.error) {
    throw new Error(salesCallMapsResult.error);
  }

  return (
    <SalesCallMapsClient
      salesCallMaps={salesCallMapsResult.data || []}
      clients={clientsResult.data || []}
      meetings={meetingsResult.data || []}
      formSubmissions={submissionsResult.data || []}
    />
  );
}
