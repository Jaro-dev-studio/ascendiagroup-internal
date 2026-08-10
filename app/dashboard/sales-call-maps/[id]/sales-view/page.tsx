import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { getSalesCallMap } from "@/lib/fetchers";
import prisma from "@/lib/prisma";
import { SalesViewClient } from "./client";

interface SalesViewPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SalesViewPage({ params }: SalesViewPageProps) {
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

  const salesCallMapResult = await getSalesCallMap(id);

  if (salesCallMapResult.error) {
    throw new Error(salesCallMapResult.error);
  }

  if (!salesCallMapResult.data) {
    notFound();
  }

  return <SalesViewClient salesCallMap={salesCallMapResult.data} />;
}
