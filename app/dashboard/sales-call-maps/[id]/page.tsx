import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { getSalesCallMap, getFormSubmissionsForLinking } from "@/lib/fetchers";
import prisma from "@/lib/prisma";
import { SalesCallMapDetailClient } from "./client";

interface SalesCallMapDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SalesCallMapDetailPage({
  params,
}: SalesCallMapDetailPageProps) {
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

  const [salesCallMapResult, submissionsResult] = await Promise.all([
    getSalesCallMap(id),
    getFormSubmissionsForLinking(),
  ]);

  if (salesCallMapResult.error) {
    throw new Error(salesCallMapResult.error);
  }

  if (!salesCallMapResult.data) {
    notFound();
  }

  return (
    <SalesCallMapDetailClient
      salesCallMap={salesCallMapResult.data}
      formSubmissions={submissionsResult.data || []}
    />
  );
}
