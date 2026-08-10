import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Calculation } from "@prisma/client";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalculationCard } from "./CalculationCard";
import { authOptions } from "@/authOptions";

export default async function CalculationsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) redirect("/login");

  const calculations = await prisma.calculation.findMany({
    where: {
      userId: (session.user as { id: string }).id,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900">Your Calculations</h1>
        <Link href="/dashboard/calculation/new">
          <Button>
            <Plus className="mr-2 size-4" />
            New Calculation
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {calculations.map((calculation: Calculation) => (
          <CalculationCard key={calculation.id} calculation={calculation} />
        ))}
      </div>
    </div>
  );
} 