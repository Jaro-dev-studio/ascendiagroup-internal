import { createOrResumeSession } from "./actions";
import { MvpPlannerClient } from "./client";

interface MvpPlannerPageProps {
  searchParams: Promise<{
    email?: string;
    name?: string;
  }>;
}

export default async function MvpPlannerPage({
  searchParams,
}: MvpPlannerPageProps) {
  const params = await searchParams;
  const email = params.email || "";
  const name = params.name || "";

  if (!email) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F7F7F7]">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#2E2E2E]">
            Missing email parameter
          </h1>
          <p className="mt-2 text-[#2E2E2E]/60">
            This page requires an email address to get started.
          </p>
        </div>
      </div>
    );
  }

  const result = await createOrResumeSession(email, name);

  if (result.error || !result.data) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F7F7F7]">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#2E2E2E]">
            Something went wrong
          </h1>
          <p className="mt-2 text-[#2E2E2E]/60">
            {result.error || "Failed to initialize your session."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <MvpPlannerClient
      session={result.data}
      userName={name || result.data.name || ""}
    />
  );
}
