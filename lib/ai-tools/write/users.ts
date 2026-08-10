import { createUser, updateUserRole, deleteUser, resetUserPassword } from "@/lib/actions";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { clientNameFor, deletePreview, unwrapAction } from "./helpers";

const ROLE_ENUM = ["ADMIN", "DEVELOPER", "CLIENT"] as const;
type Role = (typeof ROLE_ENUM)[number];

export const userWriteTools: AITool[] = [
  defineTool({
    name: "createUser",
    label: "Create User",
    risk: "additive",
    description:
      "Create a user account and generate a password for them. CLIENT users must be linked to a client company.",
    parameters: {
      properties: {
        email: { type: "string", description: "The user's email address" },
        role: { type: "string", enum: [...ROLE_ENUM], description: "The user's role" },
        clientCompanyId: {
          type: "string",
          description: "Client company ID, required for CLIENT users",
        },
      },
      required: ["email", "role"],
    },
    preview: async (args) => {
      const clientName = await clientNameFor(args.clientCompanyId);
      return {
        title: "Create user",
        summary: `${args.email} will be created as ${args.role}${clientName ? ` for ${clientName}` : ""}, with a generated password.`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        createUser({
          email: args.email as string,
          role: args.role as Role,
          clientCompanyId: args.clientCompanyId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "updateUserRole",
    label: "Change User Role",
    risk: "destructive",
    description:
      "Change a user's role. Granting ADMIN gives full access to every part of the dashboard.",
    parameters: {
      properties: {
        userId: { type: "string", description: "The user ID" },
        role: { type: "string", enum: [...ROLE_ENUM], description: "The new role" },
        clientCompanyId: {
          type: "string",
          description: "Client company ID, required when changing to CLIENT",
        },
      },
      required: ["userId", "role"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("user", String(args.userId));
      return {
        title: "Change user role",
        summary: `${label ?? String(args.userId)} → ${args.role}${args.role === "ADMIN" ? ". This grants full dashboard access." : ""}`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateUserRole(
          args.userId as string,
          args.role as Role,
          args.clientCompanyId as string | undefined
        )
      ),
  }),

  defineTool({
    name: "resetUserPassword",
    label: "Reset User Password",
    risk: "destructive",
    description:
      "Generate a new password for a user. Their current password stops working immediately.",
    parameters: {
      properties: { userId: { type: "string", description: "The user ID" } },
      required: ["userId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("user", String(args.userId));
      return {
        title: "Reset user password",
        summary: `${label ?? String(args.userId)} will get a new password and their current one will stop working.`,
      };
    },
    execute: async (args) => unwrapAction(resetUserPassword(args.userId as string)),
  }),

  defineTool({
    name: "deleteUser",
    label: "Delete User",
    risk: "destructive",
    description: "Permanently delete a user account.",
    parameters: {
      properties: { userId: { type: "string", description: "The user ID" } },
      required: ["userId"],
    },
    preview: deletePreview("user", "userId", "user"),
    execute: async (args) => unwrapAction(deleteUser(args.userId as string)),
  }),
];
