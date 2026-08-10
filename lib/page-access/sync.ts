import "server-only";

import prisma from "@/lib/prisma";
import { PAGE_REGISTRY } from "@/config/page-registry";
import { CLIENT_PAGES, DEVELOPER_PAGES } from "@/lib/constants";

export interface SyncPagesResult {
  created: number;
  updated: number;
  deactivated: number;
  seeded: boolean;
  // True when the database already matched the registry and nothing was written.
  skipped: boolean;
}

interface PageFingerprintInput {
  path: string;
  label: string;
  group: string | null;
  sortOrder: number;
}

// Comparing fingerprints lets the common case (nothing changed since the last
// visit) cost a single select instead of a write per page.
function fingerprint(pages: PageFingerprintInput[]): string {
  return pages
    .map((page) => `${page.path}|${page.label}|${page.group ?? ""}|${page.sortOrder}`)
    .sort()
    .join("\n");
}

// Mirrors the pre-database allowlists so an existing deployment keeps working
// the moment page access is switched on.
async function seedRoleDefaults(): Promise<void> {
  console.log("[PageAccess] first sync detected, seeding role defaults...");

  const pages = await prisma.page.findMany({ select: { id: true, path: true } });
  const pageIdByPath = new Map(pages.map((page) => [page.path, page.id]));

  const seeds: { role: "CLIENT" | "DEVELOPER"; paths: string[] }[] = [
    { role: "CLIENT", paths: CLIENT_PAGES },
    { role: "DEVELOPER", paths: DEVELOPER_PAGES },
  ];

  const rows = seeds.flatMap(({ role, paths }) =>
    paths
      .map((path) => pageIdByPath.get(path))
      .filter((pageId): pageId is string => Boolean(pageId))
      .map((pageId) => ({ role, pageId }))
  );

  if (rows.length === 0) return;

  await prisma.rolePageAccess.createMany({ data: rows, skipDuplicates: true });
  console.log(`[PageAccess] seeded ${rows.length} role defaults`);
}

// Reconciles the Page table with config/page-registry.ts. Pages removed from the
// codebase are deactivated rather than deleted so their access rows survive a rename.
export async function syncPages(): Promise<SyncPagesResult> {
  console.log(`[PageAccess] syncing ${PAGE_REGISTRY.length} registry pages...`);

  const existing = await prisma.page.findMany({
    select: {
      id: true,
      path: true,
      label: true,
      group: true,
      sortOrder: true,
      isActive: true,
    },
  });
  const existingByPath = new Map(existing.map((page) => [page.path, page]));
  const isFirstRun = existing.length === 0;

  const activePages = existing.filter((page) => page.isActive);
  if (fingerprint(activePages) === fingerprint(PAGE_REGISTRY)) {
    console.log("[PageAccess] registry already matches the database, nothing to do");
    return {
      created: 0,
      updated: 0,
      deactivated: 0,
      seeded: false,
      skipped: true,
    };
  }

  let created = 0;
  let updated = 0;

  for (const entry of PAGE_REGISTRY) {
    const data = {
      label: entry.label,
      group: entry.group,
      sortOrder: entry.sortOrder,
      isActive: true,
    };

    const current = existingByPath.get(entry.path);

    if (!current) {
      await prisma.page.create({ data: { path: entry.path, ...data } });
      created += 1;
      continue;
    }

    const isUnchanged =
      current.label === data.label &&
      current.group === data.group &&
      current.sortOrder === data.sortOrder &&
      current.isActive;

    if (isUnchanged) continue;

    await prisma.page.update({ where: { path: entry.path }, data });
    updated += 1;
  }

  const registryPaths = PAGE_REGISTRY.map((entry) => entry.path);
  const { count: deactivated } = await prisma.page.updateMany({
    where: { path: { notIn: registryPaths }, isActive: true },
    data: { isActive: false },
  });

  if (isFirstRun) {
    await seedRoleDefaults();
  }

  console.log(
    `[PageAccess] sync complete: ${created} created, ${updated} updated, ${deactivated} deactivated`
  );

  return { created, updated, deactivated, seeded: isFirstRun, skipped: false };
}
