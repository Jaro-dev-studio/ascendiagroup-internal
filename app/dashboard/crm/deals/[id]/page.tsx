import { notFound, redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth-helpers";
import {
  getCrmCompanies,
  getCrmOwners,
  getCrmPeople,
  getCrmTimeline,
  getDealDetail,
} from "@/lib/fetchers/crm";
import { DealDetailClient } from "./client";

interface DealDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const user = await getAdminUser();
  if (!user) redirect("/dashboard");

  const { id } = await params;

  const [dealResult, timelineResult, companiesResult, peopleResult, ownersResult] =
    await Promise.all([
      getDealDetail(id),
      getCrmTimeline({ dealId: id }),
      getCrmCompanies(),
      getCrmPeople(),
      getCrmOwners(),
    ]);

  if (!dealResult.data) notFound();

  return (
    <DealDetailClient
      deal={dealResult.data}
      timeline={timelineResult.data ?? []}
      companies={(companiesResult.data ?? []).map((company) => ({
        id: company.id,
        name: company.name,
      }))}
      people={(peopleResult.data ?? []).map((person) => ({
        id: person.id,
        label:
          person.fullName ||
          [person.firstName, person.lastName].filter(Boolean).join(" ") ||
          person.email ||
          "Unnamed contact",
        companyId: person.company?.id ?? null,
      }))}
      owners={ownersResult.data ?? []}
    />
  );
}
