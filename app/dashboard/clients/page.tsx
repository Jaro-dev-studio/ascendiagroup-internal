import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getClientCompanies } from "@/lib/fetchers";
import prisma from "@/lib/prisma";
import { ClientsClient } from "./client";

export default async function ClientsPage() {
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

  const { data: clients, error } = await getClientCompanies();

  if (error) {
    throw new Error(error);
  }

  return <ClientsClient clients={clients || []} />;
}
