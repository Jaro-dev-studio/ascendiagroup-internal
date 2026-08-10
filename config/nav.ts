import type { UserRole } from "@prisma/client";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: UserRole[];
  description?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL_STAFF: UserRole[] = ["OWNER", "ADMIN", "ACCOUNT_MANAGER", "SPECIALIST"];
const MANAGERS: UserRole[] = ["OWNER", "ADMIN", "ACCOUNT_MANAGER"];
const ADMINS: UserRole[] = ["OWNER", "ADMIN"];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: "LayoutDashboard",
        roles: ALL_STAFF,
        description: "Delivery health across every client",
      },
      {
        label: "Clients",
        href: "/dashboard/clients",
        icon: "Building2",
        roles: ALL_STAFF,
        description: "Practice records, services and account owners",
      },
    ],
  },
  {
    label: "Onboarding",
    items: [
      {
        label: "Intake forms",
        href: "/dashboard/onboarding",
        icon: "ClipboardList",
        roles: MANAGERS,
        description: "Form builder with conditional pathways",
      },
      {
        label: "Submissions",
        href: "/dashboard/onboarding/submissions",
        icon: "Inbox",
        roles: ALL_STAFF,
        description: "Review intake answers and scaffold delivery",
      },
    ],
  },
  {
    label: "Delivery",
    items: [
      {
        label: "Projects",
        href: "/dashboard/projects",
        icon: "FolderKanban",
        roles: ALL_STAFF,
      },
      {
        label: "Tasks",
        href: "/dashboard/tasks",
        icon: "CircleCheckBig",
        roles: ALL_STAFF,
      },
      {
        label: "Strategies",
        href: "/dashboard/strategies",
        icon: "Route",
        roles: ALL_STAFF,
      },
      {
        label: "Automations",
        href: "/dashboard/automations",
        icon: "Workflow",
        roles: MANAGERS,
      },
    ],
  },
  {
    label: "Client context",
    items: [
      {
        label: "Knowledge base",
        href: "/dashboard/knowledge-base",
        icon: "BookOpen",
        roles: ALL_STAFF,
      },
      {
        label: "Calls",
        href: "/dashboard/meetings",
        icon: "Mic",
        roles: ALL_STAFF,
      },
      {
        label: "WhatsApp",
        href: "/dashboard/whatsapp",
        icon: "MessageCircle",
        roles: ALL_STAFF,
      },
    ],
  },
  {
    label: "Reporting",
    items: [
      {
        label: "Reports",
        href: "/dashboard/reporting",
        icon: "ChartColumn",
        roles: ALL_STAFF,
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        label: "Team",
        href: "/dashboard/team",
        icon: "Users",
        roles: ADMINS,
      },
      {
        label: "Integrations",
        href: "/dashboard/integrations",
        icon: "Plug",
        roles: ADMINS,
      },
      {
        label: "Profile",
        href: "/dashboard/profile",
        icon: "UserRound",
        roles: ALL_STAFF,
      },
    ],
  },
];

export function navGroupsForRole(role: UserRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
