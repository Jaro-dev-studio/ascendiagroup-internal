import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth-helpers";
import { syncPages } from "@/lib/page-access/sync";
import {
  getPageAccessUsers,
  getRolePageAccess,
  getUserPageAccess,
} from "@/lib/fetchers/page-access";
import { PageAccessClient } from "./client";

interface PageAccessPageProps {
  searchParams: Promise<{ userId?: string }>;
}

export default async function PageAccessPage({ searchParams }: PageAccessPageProps) {
  const admin = await getAdminUser();

  if (!admin) {
    redirect("/dashboard");
  }

  // Pick up any pages added to the codebase since the last visit
  await syncPages();

  const { userId } = await searchParams;

  const usersResult = await getPageAccessUsers();
  if (usersResult.error) {
    throw new Error(usersResult.error);
  }

  const users = usersResult.data || [];
  const selectedUserId =
    userId && users.some((user) => user.id === userId)
      ? userId
      : users[0]?.id || null;

  const [userAccessResult, roleAccessResult] = await Promise.all([
    selectedUserId
      ? getUserPageAccess(selectedUserId)
      : Promise.resolve({ data: [], error: null }),
    getRolePageAccess(),
  ]);

  if (roleAccessResult.error) {
    throw new Error(roleAccessResult.error);
  }

  return (
    <PageAccessClient
      users={users}
      selectedUserId={selectedUserId}
      userAccess={userAccessResult.data || []}
      roleAccess={roleAccessResult.data || []}
    />
  );
}
