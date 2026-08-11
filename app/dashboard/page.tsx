import { requireStaff } from "@/lib/auth-helpers";
import { getDashboardOverview } from "@/lib/fetchers/dashboard";

import { DashboardClient } from "./client";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireStaff();
  const { data, error } = await getDashboardOverview(user.id);

  return (
    <DashboardClient
      overview={data}
      error={error}
      firstName={(user.name ?? user.email).split(" ")[0]}
    />
  );
}
