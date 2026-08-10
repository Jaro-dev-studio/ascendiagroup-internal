import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getUsers, getClientCompanies } from "@/lib/fetchers";
import prisma from "@/lib/prisma";
import { UsersClient } from "./client";

export default async function UsersPage() {
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

  const [usersResult, clientCompaniesResult] = await Promise.all([
    getUsers(),
    getClientCompanies(),
  ]);

  if (usersResult.error) {
    throw new Error(usersResult.error);
  }

  // Extract just id and name for client companies
  const clientCompanies = (clientCompaniesResult.data || []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <UsersClient
      users={usersResult.data || []}
      currentUserId={currentUser.id}
      clientCompanies={clientCompanies}
    />
  );
}
