import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getGovContracts } from "@/lib/fetchers";
import { SamGovClient } from "./client";

export default async function SamGovPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { data: contracts, error } = await getGovContracts();

  if (error) {
    throw new Error(error);
  }

  return <SamGovClient contracts={contracts || []} />;
}
