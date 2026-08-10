import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCompetitorProfile } from "@/lib/fetchers";
import { CompetitorProfileClient } from "./client";

interface CompetitorProfilePageProps {
  params: Promise<{ name: string }>;
}

export default async function CompetitorProfilePage({
  params,
}: CompetitorProfilePageProps) {
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

  const { name } = await params;
  const recipientName = decodeURIComponent(name);
  const { data, error } = await getCompetitorProfile(recipientName);

  if (error || !data) {
    redirect("/dashboard/sam-gov/competitors");
  }

  return <CompetitorProfileClient profile={data} />;
}
