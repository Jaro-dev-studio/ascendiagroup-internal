import { Logo } from "@/components/logo";
import { getPublicForm } from "@/lib/fetchers/onboarding";

import { PublicOnboardingClient } from "./client";

export const metadata = { title: "Client onboarding" };

export default async function PublicOnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { data } = await getPublicForm(token);

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-card">
          <Logo className="justify-center" />
          <h1 className="mt-6 text-lg font-semibold text-secondary-900">
            This onboarding link is not valid
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The link may have expired or been replaced. Ask your account manager
            for a new one.
          </p>
        </div>
      </main>
    );
  }

  return (
    <PublicOnboardingClient
      token={token}
      formName={data.form.name}
      intro={data.form.intro}
      isComplete={data.status !== "INVITED"}
      fields={data.form.fields}
      defaults={{
        practiceName: data.practiceName ?? data.client?.name ?? "",
        contactName: data.contactName ?? "",
        contactEmail: data.contactEmail ?? "",
        contactPhone: data.contactPhone ?? "",
      }}
    />
  );
}
