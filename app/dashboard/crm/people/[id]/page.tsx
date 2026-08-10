import { notFound, redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth-helpers";
import {
  getCrmCompanies,
  getCrmOwners,
  getCrmTimeline,
  getPersonDetail,
} from "@/lib/fetchers/crm";
import { PersonDetailClient } from "./client";

interface PersonDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PersonDetailPage({
  params,
}: PersonDetailPageProps) {
  const user = await getAdminUser();
  if (!user) redirect("/dashboard");

  const { id } = await params;

  const [personResult, timelineResult, companiesResult, ownersResult] =
    await Promise.all([
      getPersonDetail(id),
      getCrmTimeline({ personId: id }),
      getCrmCompanies(),
      getCrmOwners(),
    ]);

  if (!personResult.data) notFound();

  return (
    <PersonDetailClient
      person={personResult.data}
      timeline={timelineResult.data ?? []}
      companies={(companiesResult.data ?? []).map((company) => ({
        id: company.id,
        name: company.name,
      }))}
      owners={ownersResult.data ?? []}
    />
  );
}
