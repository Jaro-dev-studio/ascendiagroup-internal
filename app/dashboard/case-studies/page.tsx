import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getCaseStudies } from "@/lib/fetchers";
import { CaseStudiesClient } from "./client";

export default async function CaseStudiesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  const { data: caseStudies, error } = await getCaseStudies();

  if (error) {
    throw new Error(error);
  }

  return <CaseStudiesClient caseStudies={caseStudies || []} />;
}
