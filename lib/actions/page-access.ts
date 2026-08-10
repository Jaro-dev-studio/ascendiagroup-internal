"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth-helpers";
import { syncPages, type SyncPagesResult } from "@/lib/page-access/sync";
import type { UserRole } from "@prisma/client";

const PAGE_ACCESS_PATH = "/dashboard/page-access";

export interface UserPageAccessUpdate {
  pageId: string;
  // null clears the override and falls back to the role default.
  allowed: boolean | null;
}

export async function syncPagesAction(): Promise<{
  data: SyncPagesResult | null;
  error: string | null;
}> {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return { data: null, error: "Only admins can sync pages" };
    }

    console.log("[PageAccess] admin triggered a page registry sync...");
    const result = await syncPages();

    revalidatePath(PAGE_ACCESS_PATH);
    return { data: result, error: null };
  } catch (error) {
    console.error("Error syncing pages:", error);
    return { data: null, error: "Failed to sync pages" };
  }
}

async function applyUserUpdates(
  userId: string,
  updates: UserPageAccessUpdate[]
): Promise<void> {
  const cleared = updates
    .filter((update) => update.allowed === null)
    .map((update) => update.pageId);

  const set = updates.filter(
    (update): update is { pageId: string; allowed: boolean } =>
      update.allowed !== null
  );

  await prisma.$transaction([
    ...(cleared.length > 0
      ? [
        prisma.userPageAccess.deleteMany({
          where: { userId, pageId: { in: cleared } },
        }),
      ]
      : []),
    ...set.map((update) =>
      prisma.userPageAccess.upsert({
        where: { userId_pageId: { userId, pageId: update.pageId } },
        create: { userId, pageId: update.pageId, allowed: update.allowed },
        update: { allowed: update.allowed },
      })
    ),
  ]);
}

export async function setUserPageAccess(
  userId: string,
  pageId: string,
  allowed: boolean | null
): Promise<{ data: { success: true } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return { data: null, error: "Only admins can change page access" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    if (user.role === "ADMIN") {
      return { data: null, error: "Admins always have access to every page" };
    }

    console.log(
      `[PageAccess] setting page ${pageId} for user ${userId} to ${
        allowed === null ? "role default" : allowed
      }...`
    );

    await applyUserUpdates(userId, [{ pageId, allowed }]);

    revalidatePath(PAGE_ACCESS_PATH);
    revalidatePath("/dashboard", "layout");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Error setting user page access:", error);
    return { data: null, error: "Failed to update page access" };
  }
}

export async function setUserPageAccessBulk(
  userId: string,
  updates: UserPageAccessUpdate[]
): Promise<{ data: { success: true } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return { data: null, error: "Only admins can change page access" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    if (user.role === "ADMIN") {
      return { data: null, error: "Admins always have access to every page" };
    }

    if (updates.length === 0) {
      return { data: { success: true }, error: null };
    }

    console.log(
      `[PageAccess] applying ${updates.length} page access updates for user ${userId}...`
    );

    await applyUserUpdates(userId, updates);

    revalidatePath(PAGE_ACCESS_PATH);
    revalidatePath("/dashboard", "layout");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Error bulk setting user page access:", error);
    return { data: null, error: "Failed to update page access" };
  }
}

export async function setRolePageAccess(
  role: UserRole,
  pageId: string,
  enabled: boolean
): Promise<{ data: { success: true } | null; error: string | null }> {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return { data: null, error: "Only admins can change role defaults" };
    }

    if (role === "ADMIN") {
      return { data: null, error: "Admins always have access to every page" };
    }

    console.log(
      `[PageAccess] setting role default ${role} for page ${pageId} to ${enabled}...`
    );

    if (enabled) {
      await prisma.rolePageAccess.upsert({
        where: { role_pageId: { role, pageId } },
        create: { role, pageId },
        update: {},
      });
    } else {
      await prisma.rolePageAccess.deleteMany({ where: { role, pageId } });
    }

    revalidatePath(PAGE_ACCESS_PATH);
    revalidatePath("/dashboard", "layout");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Error setting role page access:", error);
    return { data: null, error: "Failed to update role default" };
  }
}
