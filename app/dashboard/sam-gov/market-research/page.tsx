import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getMarketResearchSummary, getGovSpendingRecords, getGovAwardedContracts } from "@/lib/fetchers";
import { MarketResearchClient } from "./client";

export default async function MarketResearchPage() {
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

  const [summaryResult, recordsResult, contractsResult] = await Promise.all([
    getMarketResearchSummary(),
    getGovSpendingRecords(),
    getGovAwardedContracts(),
  ]);

  return (
    <MarketResearchClient
      summary={summaryResult.data}
      records={recordsResult.data || []}
      awardedContracts={contractsResult.data || []}
    />
  );
}
