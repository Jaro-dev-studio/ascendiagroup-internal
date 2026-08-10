import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth-helpers";
import { getCrmCompanies, getCrmOwners } from "@/lib/fetchers/crm";
import { CompaniesClient } from "./client";

export default async function CrmCompaniesPage() {
  const user = await getAdminUser();
  if (!user) redirect("/dashboard");

  const [companiesResult, ownersResult] = await Promise.all([
    getCrmCompanies(),
    getCrmOwners(),
  ]);

  return (
    <Suspense fallback={null}>
      <CompaniesClient
        companies={companiesResult.data ?? []}
        owners={ownersResult.data ?? []}
      />
    </Suspense>
  );
}
