import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth-helpers";
import { getCrmPeople, getCrmCompanies, getCrmOwners } from "@/lib/fetchers/crm";
import { PeopleClient } from "./client";

export default async function CrmPeoplePage() {
  const user = await getAdminUser();
  if (!user) redirect("/dashboard");

  const [peopleResult, companiesResult, ownersResult] = await Promise.all([
    getCrmPeople(),
    getCrmCompanies(),
    getCrmOwners(),
  ]);

  return (
    <Suspense fallback={null}>
      <PeopleClient
        people={peopleResult.data ?? []}
        companies={(companiesResult.data ?? []).map((company) => ({
          id: company.id,
          name: company.name,
        }))}
        owners={ownersResult.data ?? []}
      />
    </Suspense>
  );
}
