import { notFound, redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth-helpers";
import {
  getCompanyDetail,
  getCrmOwners,
  getCrmTimeline,
} from "@/lib/fetchers/crm";
import { CompanyDetailClient } from "./client";

// Research is kicked off from this route and finishes after the response, so the
// invocation has to stay alive well past the action itself.
export const maxDuration = 300;

interface CompanyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyDetailPage({
  params,
}: CompanyDetailPageProps) {
  const user = await getAdminUser();
  if (!user) redirect("/dashboard");

  const { id } = await params;

  const [companyResult, timelineResult, ownersResult] = await Promise.all([
    getCompanyDetail(id),
    getCrmTimeline({ companyId: id }),
    getCrmOwners(),
  ]);

  if (!companyResult.data) notFound();

  return (
    <CompanyDetailClient
      company={companyResult.data}
      timeline={timelineResult.data ?? []}
      owners={ownersResult.data ?? []}
    />
  );
}
