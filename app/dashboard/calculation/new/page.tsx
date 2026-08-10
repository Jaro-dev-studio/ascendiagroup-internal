import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";

export default async function NewCalculationPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const calculation = await prisma.calculation.create({
    data: {
      name: "Untitled Calculation",
      userId: (session.user as { id: string }).id,
    },
  });

  redirect(`/dashboard/calculation/${calculation.id}`);
} 