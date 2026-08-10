import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import RolesClient from "./RolesClient";

interface RolesPageProps {
  params: Promise<{ id: string }>;
}

export default async function RolesPage({ params }: RolesPageProps) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  const prototype = await prisma.prototype.findUnique({
    where: { id },
    include: {
      roles: true,
      createdBy: true,
    },
  });

  if (!prototype || prototype.createdBy.email !== session.user.email) {
    redirect("/dashboard");
  }

  return <RolesClient prototype={prototype} />;
} 