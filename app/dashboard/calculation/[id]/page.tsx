import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import CalculationPage from "./CalculationPage";

interface CalculationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CalculationDetailPage({ params }: CalculationDetailPageProps) {
  const session = await getServerSession(authOptions);
  const { id } = await params;
  
  if (!session || !session.user) redirect("/login");

  const calculation = await prisma.calculation.findUnique({
    where: { id },
  });

  if (!calculation || calculation.userId !== (session.user as { id: string }).id) {
    notFound();
  }

  return <CalculationPage params={{ id }} calculation={calculation} />;
} 