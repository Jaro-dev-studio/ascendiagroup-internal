import { requireStaff } from "@/lib/auth-helpers";
import { listOnboardingForms } from "@/lib/fetchers/onboarding";

import { OnboardingFormsClient } from "./client";

export const metadata = { title: "Intake forms" };

export default async function OnboardingFormsPage() {
  await requireStaff();
  const { data, error } = await listOnboardingForms();

  return <OnboardingFormsClient forms={data ?? []} error={error} />;
}
