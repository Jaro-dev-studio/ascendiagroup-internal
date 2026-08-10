import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth-helpers";
import { getSuppressions } from "@/lib/fetchers/sequences";
import { SuppressionsClient } from "./client";

export default async function SuppressionsPage() {
  const user = await getAdminUser();
  if (!user) redirect("/dashboard");

  const result = await getSuppressions();

  return <SuppressionsClient suppressions={result.data ?? []} />;
}
