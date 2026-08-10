import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { getMVPCallMap } from "@/lib/fetchers";
import prisma from "@/lib/prisma";
import { MVPSalesViewClient } from "./client";

interface MVPSalesViewPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function MVPSalesViewPage({ params }: MVPSalesViewPageProps) {
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

  const mvpCallMapResult = await getMVPCallMap(id);

  if (mvpCallMapResult.error) {
    throw new Error(mvpCallMapResult.error);
  }

  if (!mvpCallMapResult.data) {
    notFound();
  }

  return <MVPSalesViewClient mvpCallMap={mvpCallMapResult.data} />;
}
