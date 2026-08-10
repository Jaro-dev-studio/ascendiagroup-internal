import prisma from "@/lib/prisma";
import { PAGE_GROUP_ORDER, DEFAULT_PAGE_GROUP } from "@/config/page-labels";
import type { UserRole } from "@prisma/client";

export interface PageAccessRow {
  pageId: string;
  path: string;
  label: string;
  // Access granted to the user's role by default.
  roleDefault: boolean;
  // Explicit per-user override, null when the role default applies.
  override: boolean | null;
  // What the user actually gets.
  effective: boolean;
}

export interface PageAccessGroup {
  group: string;
  pages: PageAccessRow[];
}

export interface RoleAccessRow {
  pageId: string;
  path: string;
  label: string;
  // Page id is allowed for each role in this map.
  roles: Record<Exclude<UserRole, "ADMIN">, boolean>;
}

export interface RoleAccessGroup {
  group: string;
  pages: RoleAccessRow[];
}

export interface PageAccessUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  overrideCount: number;
}

function groupRank(group: string): number {
  const index = PAGE_GROUP_ORDER.indexOf(group);
  return index === -1 ? PAGE_GROUP_ORDER.length : index;
}

function groupPages<T extends { group: string }>(
  rows: T[]
): { group: string; pages: T[] }[] {
  const byGroup = new Map<string, T[]>();

  for (const row of rows) {
    const existing = byGroup.get(row.group);
    if (existing) {
      existing.push(row);
    } else {
      byGroup.set(row.group, [row]);
    }
  }

  return Array.from(byGroup.entries())
    .sort(([a], [b]) => groupRank(a) - groupRank(b))
    .map(([group, pages]) => ({ group, pages }));
}

// Users an admin can manage page access for. Admins are excluded because they
// always have full access.
export async function getPageAccessUsers(): Promise<{
  data: PageAccessUser[] | null;
  error: string | null;
}> {
  try {
    const users = await prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      orderBy: [{ role: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        _count: { select: { pageAccess: true } },
      },
    });

    return {
      data: users.map(({ _count, ...user }) => ({
        ...user,
        overrideCount: _count.pageAccess,
      })),
      error: null,
    };
  } catch (error) {
    console.error("Error fetching page access users:", error);
    return { data: null, error: "Failed to fetch users" };
  }
}

export async function getUserPageAccess(userId: string): Promise<{
  data: PageAccessGroup[] | null;
  error: string | null;
}> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    const [pages, roleAccess, userAccess] = await Promise.all([
      prisma.page.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, path: true, label: true, group: true },
      }),
      prisma.rolePageAccess.findMany({
        where: { role: user.role },
        select: { pageId: true },
      }),
      prisma.userPageAccess.findMany({
        where: { userId },
        select: { pageId: true, allowed: true },
      }),
    ]);

    const roleAllowed = new Set(roleAccess.map((row) => row.pageId));
    const overrides = new Map(userAccess.map((row) => [row.pageId, row.allowed]));

    const rows = pages.map((page) => {
      const roleDefault = roleAllowed.has(page.id);
      const override = overrides.has(page.id)
        ? (overrides.get(page.id) as boolean)
        : null;

      return {
        pageId: page.id,
        path: page.path,
        label: page.label,
        group: page.group || DEFAULT_PAGE_GROUP,
        roleDefault,
        override,
        effective: override ?? roleDefault,
      };
    });

    return {
      data: groupPages(rows).map(({ group, pages: groupedPages }) => ({
        group,
        pages: groupedPages.map(({ group: _group, ...row }) => row),
      })),
      error: null,
    };
  } catch (error) {
    console.error("Error fetching user page access:", error);
    return { data: null, error: "Failed to fetch page access" };
  }
}

export async function getRolePageAccess(): Promise<{
  data: RoleAccessGroup[] | null;
  error: string | null;
}> {
  try {
    const [pages, roleAccess] = await Promise.all([
      prisma.page.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, path: true, label: true, group: true },
      }),
      prisma.rolePageAccess.findMany({ select: { pageId: true, role: true } }),
    ]);

    const allowed = new Set(roleAccess.map((row) => `${row.role}:${row.pageId}`));

    const rows = pages.map((page) => ({
      pageId: page.id,
      path: page.path,
      label: page.label,
      group: page.group || DEFAULT_PAGE_GROUP,
      roles: {
        DEVELOPER: allowed.has(`DEVELOPER:${page.id}`),
        CLIENT: allowed.has(`CLIENT:${page.id}`),
      },
    }));

    return {
      data: groupPages(rows).map(({ group, pages: groupedPages }) => ({
        group,
        pages: groupedPages.map(({ group: _group, ...row }) => row),
      })),
      error: null,
    };
  } catch (error) {
    console.error("Error fetching role page access:", error);
    return { data: null, error: "Failed to fetch role defaults" };
  }
}
