import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getGovOpportunities } from "@/lib/fetchers";
import { OpportunitiesClient } from "./client";

export default async function OpportunitiesPage() {
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

  const { data: opportunities, error } = await getGovOpportunities({
    isDismissed: false,
  });

  if (error) {
    throw new Error(error);
  }

  return <OpportunitiesClient opportunities={opportunities || []} />;
}
