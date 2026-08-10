/**
 * Scans app/dashboard for pages and writes config/page-registry.ts.
 *
 * A page becomes an access-controlled "section" when it is the shallowest route
 * with a page.tsx on its branch, so /dashboard/crm/people also covers
 * /dashboard/crm/people/[id], and /dashboard/case-studies covers /new and /[id].
 *
 * Run with `pnpm generate:pages`. It also runs automatically before dev and build.
 */

import fs from "fs";
import path from "path";
import {
  ALWAYS_ALLOWED_PAGE_PATHS,
  DEFAULT_PAGE_GROUP,
  PAGE_GROUPS,
  PAGE_GROUP_ORDER,
  PAGE_LABELS,
} from "../config/page-labels";

const DASHBOARD_DIR = path.join(process.cwd(), "app", "dashboard");
const OUTPUT_FILE = path.join(process.cwd(), "config", "page-registry.ts");

interface DiscoveredPage {
  path: string;
  label: string;
  group: string;
}

function collectRoutes(dir: string, routePrefix: string, routes: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  if (entries.some((entry) => entry.isFile() && entry.name === "page.tsx")) {
    routes.push(routePrefix);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Route groups like (marketing) do not appear in the URL.
    const isRouteGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
    const nextPrefix = isRouteGroup ? routePrefix : `${routePrefix}/${entry.name}`;
    collectRoutes(path.join(dir, entry.name), nextPrefix, routes);
  }
}

function toLabel(route: string): string {
  const override = PAGE_LABELS[route];
  if (override) return override;

  const segment = route.split("/").pop() || route;
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isSectionRoot(route: string, allRoutes: Set<string>): boolean {
  const segments = route.split("/").filter(Boolean);
  // Start below /dashboard so the dashboard root never shadows everything.
  for (let i = 2; i < segments.length; i++) {
    const ancestor = `/${segments.slice(0, i).join("/")}`;
    if (allRoutes.has(ancestor)) return false;
  }
  return true;
}

function discoverPages(): DiscoveredPage[] {
  const routes: string[] = [];
  collectRoutes(DASHBOARD_DIR, "/dashboard", routes);

  const routeSet = new Set(routes);

  return routes
    .filter((route) => route !== "/dashboard")
    .filter((route) => !route.includes("["))
    .filter((route) => !ALWAYS_ALLOWED_PAGE_PATHS.includes(route))
    .filter((route) => isSectionRoot(route, routeSet))
    .map((route) => ({
      path: route,
      label: toLabel(route),
      group: PAGE_GROUPS[route] || DEFAULT_PAGE_GROUP,
    }))
    .sort((a, b) => {
      const groupDiff =
        groupRank(a.group) - groupRank(b.group);
      if (groupDiff !== 0) return groupDiff;
      return a.label.localeCompare(b.label);
    });
}

function groupRank(group: string): number {
  const index = PAGE_GROUP_ORDER.indexOf(group);
  return index === -1 ? PAGE_GROUP_ORDER.length : index;
}

function renderFile(pages: DiscoveredPage[]): string {
  const entries = pages
    .map(
      (page, index) =>
        `  {\n    path: ${JSON.stringify(page.path)},\n    label: ${JSON.stringify(
          page.label
        )},\n    group: ${JSON.stringify(page.group)},\n    sortOrder: ${index},\n  },`
    )
    .join("\n");

  return `// GENERATED FILE - DO NOT EDIT.
// Run \`pnpm generate:pages\` to regenerate from app/dashboard.
// Labels and groups come from config/page-labels.ts.

export interface PageRegistryEntry {
  path: string;
  label: string;
  group: string;
  sortOrder: number;
}

export const PAGE_REGISTRY: PageRegistryEntry[] = [
${entries}
];
`;
}

function main(): void {
  console.log("[PageRegistry] scanning app/dashboard for pages...");
  const pages = discoverPages();

  console.log(`[PageRegistry] found ${pages.length} access-controlled pages`);
  fs.writeFileSync(OUTPUT_FILE, renderFile(pages), "utf8");
  console.log(`[PageRegistry] wrote ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

main();
