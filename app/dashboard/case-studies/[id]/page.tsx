import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { getCaseStudy } from "@/lib/fetchers";
import { CaseStudyDetailsClient } from "./client";

interface CaseStudyDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CaseStudyDetailsPage({ params }: CaseStudyDetailsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  const { id } = await params;

  const caseStudyResult = await getCaseStudy(id);

  if (caseStudyResult.error) {
    throw new Error(caseStudyResult.error);
  }

  if (!caseStudyResult.data) {
    notFound();
  }

  return (
    <CaseStudyDetailsClient
      caseStudy={caseStudyResult.data}
    />
  );
}
