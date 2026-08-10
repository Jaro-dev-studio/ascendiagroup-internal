import "server-only";

import prisma from "@/lib/prisma";
import { ALWAYS_ALLOWED_PAGE_PATHS } from "@/config/page-labels";
import type { UserRole } from "@prisma/client";

export { isPathAllowed } from "./match";

interface AccessUser {
  id: string;
  role: UserRole;
}

// Effective access is the role default, overridden per user by an explicit
// allow or deny. Admins always get everything so they cannot lock themselves out.
export async function getAllowedPagePaths(user: AccessUser): Promise<string[]> {
  const pages = await prisma.page.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, path: true },
  });

  if (user.role === "ADMIN") {
    return [...ALWAYS_ALLOWED_PAGE_PATHS, ...pages.map((page) => page.path)];
  }

  const [roleAccess, userAccess] = await Promise.all([
    prisma.rolePageAccess.findMany({
      where: { role: user.role },
      select: { pageId: true },
    }),
    prisma.userPageAccess.findMany({
      where: { userId: user.id },
      select: { pageId: true, allowed: true },
    }),
  ]);

  const roleAllowed = new Set(roleAccess.map((row) => row.pageId));
  const overrides = new Map(userAccess.map((row) => [row.pageId, row.allowed]));

  const allowedPaths = pages
    .filter((page) => overrides.get(page.id) ?? roleAllowed.has(page.id))
    .map((page) => page.path);

  return [...ALWAYS_ALLOWED_PAGE_PATHS, ...allowedPaths];
}

// Where to send a user who has no access to the page they requested.
export function getLandingPath(allowedPaths: string[]): string {
  const firstPage = allowedPaths.find(
    (path) => !ALWAYS_ALLOWED_PAGE_PATHS.includes(path)
  );
  return firstPage || "/dashboard/profile";
}
