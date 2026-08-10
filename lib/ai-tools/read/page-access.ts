import {
  getPageAccessUsers,
  getRolePageAccess,
  getUserPageAccess,
} from "@/lib/fetchers/page-access";
import { defineTool, type AITool } from "../types";

export const pageAccessReadTools: AITool[] = [
  defineTool({
    name: "queryPageAccess",
    label: "Query Page Access",
    risk: "read",
    adminOnly: true,
    description:
      "Inspect dashboard page access. With no arguments it lists the non-admin users who can be managed and how many overrides each has. With userId it returns every page with the role default, the per-user override and the effective access. With includeRoleDefaults it returns the DEVELOPER and CLIENT defaults per page. Admins always have access to every page and are not listed.",
    parameters: {
      properties: {
        userId: {
          type: "string",
          description: "Resolve with queryUsers. Returns this user's effective access per page.",
        },
        includeRoleDefaults: {
          type: "boolean",
          description: "Include the per-role page defaults for DEVELOPER and CLIENT",
        },
      },
    },
    execute: async (args) => {
      const { userId, includeRoleDefaults } = args as {
        userId?: string;
        includeRoleDefaults?: boolean;
      };

      if (userId) {
        const result = await getUserPageAccess(userId);
        if (result.error) throw new Error(result.error);

        const groups = result.data ?? [];
        const allowed = groups.flatMap((group) =>
          group.pages.filter((page) => page.effective).map((page) => page.path)
        );

        return {
          userId,
          allowedPageCount: allowed.length,
          allowedPaths: allowed,
          groups,
        };
      }

      const [users, roleDefaults] = await Promise.all([
        getPageAccessUsers(),
        includeRoleDefaults ? getRolePageAccess() : Promise.resolve({ data: null, error: null }),
      ]);

      if (users.error) throw new Error(users.error);
      if (roleDefaults.error) throw new Error(roleDefaults.error);

      return {
        count: users.data?.length ?? 0,
        users: users.data ?? [],
        ...(roleDefaults.data ? { roleDefaults: roleDefaults.data } : {}),
      };
    },
  }),
];
