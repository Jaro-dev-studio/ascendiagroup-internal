import prisma from "@/lib/prisma";
import {
  setRolePageAccess,
  setUserPageAccessBulk,
  syncPagesAction,
} from "@/lib/actions/page-access";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { unwrapAction } from "./helpers";
import type { UserRole } from "@prisma/client";

/**
 * Page access is keyed on Page.id but the model reasons in dashboard paths, so
 * every tool here accepts paths and resolves them.
 */
async function resolvePages(
  paths: string[]
): Promise<Array<{ id: string; path: string; label: string }>> {
  const pages = await prisma.page.findMany({
    where: { path: { in: paths } },
    select: { id: true, path: true, label: true },
  });

  const missing = paths.filter((path) => !pages.some((page) => page.path === path));
  if (missing.length > 0) {
    throw new Error(
      `Unknown page path(s): ${missing.join(", ")}. Use queryPageAccess to list the valid paths.`
    );
  }

  return pages;
}

export const pageAccessWriteTools: AITool[] = [
  defineTool({
    name: "setUserPageAccess",
    label: "Set User Page Access",
    risk: "additive",
    description:
      "Grant or revoke dashboard pages for one user, overriding their role default. Pass allowed true to grant, false to deny, or omit allowed to clear the override so the role default applies again. Admins cannot be changed because they always have every page. Resolve the user with queryUsers and the page paths with queryPageAccess.",
    parameters: {
      properties: {
        userId: { type: "string", description: "The user ID" },
        pagePaths: {
          type: "array",
          items: { type: "string" },
          description: "Dashboard page paths, for example \"/dashboard/crm/deals\"",
        },
        allowed: {
          type: "boolean",
          description:
            "True grants access, false denies it. Omit to clear the override and fall back to the role default.",
        },
      },
      required: ["userId", "pagePaths"],
    },
    preview: async (args) => {
      const paths = (args.pagePaths as string[]) ?? [];
      const [userName, pages] = await Promise.all([
        lookupEntityLabel("user", String(args.userId)),
        prisma.page.findMany({
          where: { path: { in: paths } },
          select: { path: true, label: true },
        }),
      ]);

      const allowed = args.allowed as boolean | undefined;
      const verb =
        allowed === undefined ? "Reset to role default" : allowed ? "Grant" : "Deny";

      return {
        title: "Set user page access",
        summary: `${verb} ${paths.length} page(s) for ${userName ?? args.userId}`,
        details: {
          Pages: pages.map((page) => `${page.label} (${page.path})`).join(", ") || "—",
          Effect:
            allowed === undefined
              ? "Override removed, the user's role default applies"
              : allowed
                ? "Explicitly allowed regardless of the role default"
                : "Explicitly denied regardless of the role default",
        },
      };
    },
    execute: async (args) => {
      const paths = (args.pagePaths as string[]) ?? [];
      if (paths.length === 0) throw new Error("Provide at least one page path");

      const pages = await resolvePages(paths);
      const allowed = (args.allowed as boolean | undefined) ?? null;

      return unwrapAction(
        setUserPageAccessBulk(
          args.userId as string,
          pages.map((page) => ({ pageId: page.id, allowed }))
        )
      );
    },
  }),

  defineTool({
    name: "setRolePageAccess",
    label: "Set Role Page Access",
    risk: "additive",
    description:
      "Change the default page access for the DEVELOPER or CLIENT role. This affects every user with that role who has no per-user override, so it is broader than setUserPageAccess. The ADMIN role cannot be changed.",
    parameters: {
      properties: {
        role: {
          type: "string",
          enum: ["DEVELOPER", "CLIENT"],
          description: "Which role's default to change",
        },
        pagePaths: {
          type: "array",
          items: { type: "string" },
          description: "Dashboard page paths to change",
        },
        enabled: { type: "boolean", description: "True grants the page to the role, false removes it" },
      },
      required: ["role", "pagePaths", "enabled"],
    },
    preview: async (args) => {
      const paths = (args.pagePaths as string[]) ?? [];
      const [pages, affected] = await Promise.all([
        prisma.page.findMany({
          where: { path: { in: paths } },
          select: { path: true, label: true },
        }),
        prisma.user.count({ where: { role: args.role as UserRole } }),
      ]);

      return {
        title: "Set role page access",
        summary: `${args.enabled ? "Grant" : "Remove"} ${paths.length} page(s) for the ${args.role} role. This affects ${affected} user(s) without a per-user override.`,
        details: {
          Pages: pages.map((page) => `${page.label} (${page.path})`).join(", ") || "—",
          Role: args.role as string,
        },
      };
    },
    execute: async (args) => {
      const paths = (args.pagePaths as string[]) ?? [];
      if (paths.length === 0) throw new Error("Provide at least one page path");

      const pages = await resolvePages(paths);
      const role = args.role as UserRole;
      const enabled = args.enabled as boolean;

      // The action handles one page at a time, so the results are rolled up here.
      for (const page of pages) {
        await unwrapAction(setRolePageAccess(role, page.id, enabled));
      }

      return { updated: pages.length, role, enabled };
    },
  }),

  defineTool({
    name: "syncPages",
    label: "Sync Page Registry",
    risk: "additive",
    description:
      "Reconcile the Page table with the generated page registry: create newly added dashboard pages, update labels and groups, and deactivate pages that no longer exist. Run this after new dashboard pages are deployed so they can be assigned.",
    parameters: { properties: {} },
    preview: async () => ({
      title: "Sync page registry",
      summary:
        "Creates, updates and deactivates Page rows to match the generated registry. Existing access assignments are preserved.",
      details: {},
    }),
    execute: async () => unwrapAction(syncPagesAction()),
  }),
];
