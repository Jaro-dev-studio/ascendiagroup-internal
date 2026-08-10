import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import DashboardPage from "./DashboardPage";

interface PrototypePageProps {
  params: Promise<{ id: string }>;
}

export default async function PrototypePage({ params }: PrototypePageProps) {
  const session = await getServerSession(authOptions);
  const { id } = await params;
  
  const isAuthenticated = !!session?.user?.email;

  const prototype = await prisma.prototype.findUnique({
    where: { id },
    include: { createdBy: true, roles: true },
  });

  if (!prototype) notFound();

  return <DashboardPage params={{ id }} roles={prototype.roles} initialData={prototype.flowData} isAuthenticated={isAuthenticated} />;
}
