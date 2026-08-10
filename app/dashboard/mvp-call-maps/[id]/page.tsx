import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { getMVPCallMap, getFormSubmissionsForLinking, getClientCompanies } from "@/lib/fetchers";
import prisma from "@/lib/prisma";
import { MVPCallMapDetailClient } from "./client";

interface MVPCallMapDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function MVPCallMapDetailPage({
  params,
}: MVPCallMapDetailPageProps) {
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

  const { id } = await params;

  const [mvpCallMapResult, submissionsResult, clientsResult] = await Promise.all([
    getMVPCallMap(id),
    getFormSubmissionsForLinking(),
    getClientCompanies(),
  ]);

  if (mvpCallMapResult.error) {
    throw new Error(mvpCallMapResult.error);
  }

  if (!mvpCallMapResult.data) {
    notFound();
  }

  return (
    <MVPCallMapDetailClient
      mvpCallMap={mvpCallMapResult.data}
      formSubmissions={submissionsResult.data || []}
      clients={clientsResult.data || []}
    />
  );
}
