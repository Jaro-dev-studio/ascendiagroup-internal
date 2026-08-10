import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function PrototypesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  const prototypes = await prisma.prototype.findMany({
    where: {
      createdBy: {
        email: session.user.email
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900">Your Prototypes</h1>
        <Link href="/dashboard/prototypes/new">
          <Button>
            <Plus className="mr-2 size-4" />
            New Prototype
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {prototypes.map((prototype) => (
          <Link 
            key={prototype.id} 
            href={`/dashboard/prototypes/${prototype.id}`}
          >
            <Card variant="interactive" className="w-full p-4">
              <h2 className="font-medium text-secondary-900">{prototype.name}</h2>
              <p className="mt-1 line-clamp-1 min-h-6 text-sm text-secondary-500">
                {prototype.description || "No description"}
              </p>
              <p className="mt-2 text-xs text-secondary-500">
                Last updated: {new Date(prototype.updatedAt).toLocaleDateString()}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
