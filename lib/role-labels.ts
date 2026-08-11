import type { UserRole } from "@prisma/client";

export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  ACCOUNT_MANAGER: "Account manager",
  SPECIALIST: "Specialist",
  CLIENT: "Client",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  OWNER: "Full access including team, integrations and workspace settings.",
  ADMIN: "Full delivery access plus team and integration management.",
  ACCOUNT_MANAGER: "Manages clients, onboarding, strategy and reporting.",
  SPECIALIST: "Works assigned tasks and client knowledge bases.",
  CLIENT: "Portal-only access to their own onboarding and reports.",
};

export const ASSIGNABLE_ROLES: UserRole[] = [
  "ADMIN",
  "ACCOUNT_MANAGER",
  "SPECIALIST",
  "CLIENT",
];
