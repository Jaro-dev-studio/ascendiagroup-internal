import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getActionItemsByClientCompany } from "@/lib/fetchers";
import { ClientActionItemsClient } from "./client";

export default async function ClientActionItemsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      clientCompany: true,
    },
  });

  if (!user || user.role !== "CLIENT") {
    redirect("/dashboard");
  }

  if (!user.clientCompany) {
    redirect("/dashboard");
  }

  const actionItemsResult = await getActionItemsByClientCompany(user.clientCompany.id);

  return (
    <ClientActionItemsClient
      clientCompanyName={user.clientCompany.name}
      actionItems={actionItemsResult.data || []}
    />
  );
}
