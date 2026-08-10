import { requireUser } from "@/lib/auth-helpers";

import { ProfileClient } from "./client";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <ProfileClient
      user={{
        name: user.name ?? "",
        email: user.email,
        jobTitle: user.jobTitle ?? "",
        phone: user.phone ?? "",
        role: user.role,
      }}
    />
  );
}
