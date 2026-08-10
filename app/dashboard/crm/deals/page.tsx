import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth-helpers";
import {
  getCrmCompanies,
  getCrmDeals,
  getCrmOwners,
  getCrmPeople,
} from "@/lib/fetchers/crm";
import { DealsClient } from "./client";

export default async function CrmDealsPage() {
  const user = await getAdminUser();
  if (!user) redirect("/dashboard");

  const [dealsResult, companiesResult, peopleResult, ownersResult] =
    await Promise.all([
      getCrmDeals(),
      getCrmCompanies(),
      getCrmPeople(),
      getCrmOwners(),
    ]);

  return (
    <Suspense fallback={null}>
      <DealsClient
        deals={dealsResult.data?.deals ?? []}
        stages={dealsResult.data?.stages ?? []}
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
    </Suspense>
  );
}
