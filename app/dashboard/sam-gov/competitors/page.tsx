import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCompetitorRankings } from "@/lib/fetchers";
import { CompetitorsClient } from "./client";

interface CompetitorsPageProps {
  searchParams: Promise<{ naics?: string; setAside?: string }>;
}

export default async function CompetitorsPage({
  searchParams,
}: CompetitorsPageProps) {
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

  const params = await searchParams;

  const { data } = await getCompetitorRankings({
    naicsCode: params.naics || undefined,
    setAsideType: params.setAside || undefined,
  });

  return (
    <CompetitorsClient
      rankings={data?.rankings || []}
      samAwardees={data?.samAwardees || []}
      setAsideTypes={data?.setAsideTypes || []}
      activeNaics={params.naics || "all"}
      activeSetAside={params.setAside || "all"}
    />
  );
}
