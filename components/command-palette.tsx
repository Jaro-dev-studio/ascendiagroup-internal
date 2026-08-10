"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  ListTodo,
  Building2,
  CheckSquare,
  MessageSquarePlus,
  FileText,
  FileSpreadsheet,
  Users,
  Activity,
  BarChart3,
  UserCircle,
  Bug,
  Lightbulb,
  Plus,
  FolderGit2,
  Landmark,
  LayoutDashboard,
  Contact,
  Handshake,
  Send,
  Video,
  Phone,
  GitBranch,
  Tag,
  Image as ImageIcon,
  CalendarClock,
  ClipboardList,
  Rocket,
  Code,
  Bell,
  Repeat,
  Presentation,
  BookOpen,
  MailPlus,
  PlayCircle,
  ShieldCheck,
  BadgeDollarSign,
} from "lucide-react";
import { searchCommandPalette, CommandPaletteResult } from "@/lib/actions";
import { isPathAllowed } from "@/lib/page-access/match";
import { UserRole } from "@prisma/client";
import { useCreateTaskModalSafe } from "@/components/modals/create-task-modal-provider";
import { useCreateProjectModalSafe } from "@/components/modals/create-project-modal-provider";

interface NavigationItem {
  href: string;
  label: string;
  icon: React.ElementType;
  section: string;
  // Extra search terms for pages whose label doesn't match what people type.
  keywords?: string[];
  // Public pages outside the dashboard: opened in a new tab and exempt from
  // page-access filtering, since only access-controlled pages live in allowedPaths.
  external?: boolean;
}

// Mirrors the sidebar in app/dashboard/Sidebar.tsx. Keep both in sync when
// adding or removing a dashboard page.
const adminNavigationItems: NavigationItem[] = [
  { href: "/dashboard/overview", label: "Overview", icon: LayoutDashboard, section: "General" },

  { href: "/dashboard/crm/people", label: "People", icon: Contact, section: "CRM", keywords: ["contacts", "leads"] },
  { href: "/dashboard/crm/companies", label: "Accounts", icon: Building2, section: "CRM", keywords: ["companies", "organisations"] },
  { href: "/dashboard/crm/deals", label: "Deals", icon: Handshake, section: "CRM", keywords: ["pipeline", "opportunities"] },
  { href: "/dashboard/crm/sequences", label: "Sequences", icon: Send, section: "CRM", keywords: ["outreach", "email"] },
  { href: "/dashboard/crm/recording-rules", label: "Recording Rules", icon: Video, section: "CRM", keywords: ["bots", "recall"] },

  { href: "/dashboard/tasks", label: "Tasks", icon: ListTodo, section: "Operations" },
  { href: "/dashboard/clients", label: "Companies", icon: Building2, section: "Operations", keywords: ["clients"] },
  { href: "/dashboard/calls", label: "Past Calls", icon: Phone, section: "Operations", keywords: ["meetings", "recordings", "transcripts"] },
  { href: "/dashboard/action-items", label: "Action Items", icon: CheckSquare, section: "Operations" },
  { href: "/dashboard/feature-requests", label: "Requests", icon: MessageSquarePlus, section: "Operations", keywords: ["feature", "bug"] },
  { href: "/dashboard/workflow-maps", label: "Workflow Maps", icon: GitBranch, section: "Operations", keywords: ["automations"] },

  { href: "/dashboard/case-studies", label: "Case Studies", icon: FileText, section: "Advertising" },
  { href: "/dashboard/offers", label: "Offers", icon: Tag, section: "Advertising" },
  { href: "/dashboard/submissions", label: "Form Submissions", icon: FileSpreadsheet, section: "Advertising", keywords: ["leads", "embed"] },
  { href: "/dashboard/live-funnel", label: "Live Funnel", icon: Activity, section: "Advertising" },
  { href: "/dashboard/ads", label: "Ads", icon: ImageIcon, section: "Advertising", keywords: ["meta", "creatives", "generator", "library"] },

  { href: "/dashboard/upcoming-calls", label: "Upcoming Calls", icon: CalendarClock, section: "Sales", keywords: ["calendar", "schedule"] },
  { href: "/dashboard/sales-call-maps", label: "Call Maps", icon: ClipboardList, section: "Sales" },
  { href: "/dashboard/mvp-call-maps", label: "MVP Call Maps", icon: Rocket, section: "Sales", keywords: ["scoping", "quote"] },
  { href: "/dashboard/demos", label: "Products", icon: Code, section: "Sales", keywords: ["demos", "builds"] },
  { href: "/businessos-pricing", label: "Pricing Page", icon: BadgeDollarSign, section: "Sales", keywords: ["pricing", "rates", "tiers", "retainer", "businessos"], external: true },

  { href: "/dashboard/users", label: "Users", icon: Users, section: "Admin", keywords: ["team", "accounts"] },
  { href: "/dashboard/page-access", label: "Page Access", icon: ShieldCheck, section: "Admin", keywords: ["permissions", "access", "roles"] },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell, section: "Admin" },
  { href: "/dashboard/recurring-tasks", label: "Recurring Tasks", icon: Repeat, section: "Admin" },
  { href: "/dashboard/calculation", label: "Calculations", icon: BarChart3, section: "Admin", keywords: ["pricing"] },
  { href: "/dashboard/presentations", label: "Presentations", icon: Presentation, section: "Admin", keywords: ["slides", "decks"] },
  { href: "/dashboard/sam-gov", label: "SAM.gov", icon: Landmark, section: "Admin", keywords: ["government", "contracts", "opportunities"] },
  { href: "/dashboard/knowledge-base", label: "Knowledge Base", icon: BookOpen, section: "Admin", keywords: ["docs"] },
  { href: "/dashboard/settings/followup-templates", label: "Followup Templates", icon: MailPlus, section: "Admin", keywords: ["email", "settings"] },

  { href: "/dashboard/profile", label: "Profile Settings", icon: UserCircle, section: "Account" },
];

const developerNavigationItems: NavigationItem[] = [
  { href: "/dashboard/tasks", label: "Tasks", icon: ListTodo, section: "Go to" },
  { href: "/dashboard/action-items", label: "Action Items", icon: CheckSquare, section: "Go to" },
  { href: "/dashboard/feature-requests", label: "Requests", icon: MessageSquarePlus, section: "Go to" },
  { href: "/dashboard/studio-bug-report", label: "Studio Platform Bug Report", icon: Bug, section: "Go to" },
  { href: "/dashboard/profile", label: "Profile Settings", icon: UserCircle, section: "Go to" },
];

const clientNavigationItems: NavigationItem[] = [
  { href: "/dashboard/client-tasks", label: "Jaro.dev Tasks", icon: ListTodo, section: "Go to" },
  { href: "/dashboard/client-action-items", label: "Action Items", icon: CheckSquare, section: "Go to" },
  { href: "/dashboard/feature-requests", label: "Feature Requests", icon: Lightbulb, section: "Go to" },
  { href: "/dashboard/bug-requests", label: "Bug Fix Requests", icon: Bug, section: "Go to" },
  { href: "/dashboard/studio-bug-report", label: "Studio Platform Bug Report", icon: Bug, section: "Go to" },
  { href: "/dashboard/tutorials", label: "Tutorials", icon: PlayCircle, section: "Go to" },
  { href: "/dashboard/profile", label: "Profile Settings", icon: UserCircle, section: "Go to" },
];

const typeIcons: Record<CommandPaletteResult["type"], React.ElementType> = {
  task: ListTodo,
  "action-item": CheckSquare,
  request: MessageSquarePlus,
  client: Building2,
  person: Contact,
  deal: Handshake,
  sequence: Send,
  meeting: Phone,
  "case-study": FileText,
  offer: Tag,
  submission: FileSpreadsheet,
  user: Users,
  workflow: GitBranch,
  "sales-call-map": ClipboardList,
  "mvp-call-map": Rocket,
  demo: Code,
  presentation: Presentation,
  calculation: BarChart3,
  "gov-contract": Landmark,
  "knowledge-base": BookOpen,
};

const typeLabels: Record<CommandPaletteResult["type"], string> = {
  task: "Task",
  "action-item": "Action Item",
  request: "Request",
  client: "Company",
  person: "Person",
  deal: "Deal",
  sequence: "Sequence",
  meeting: "Past Call",
  "case-study": "Case Study",
  offer: "Offer",
  submission: "Form Submission",
  user: "User",
  workflow: "Workflow Map",
  "sales-call-map": "Call Map",
  "mvp-call-map": "MVP Call Map",
  demo: "Product",
  presentation: "Presentation",
  calculation: "Calculation",
  "gov-contract": "SAM.gov Contract",
  "knowledge-base": "Knowledge Base",
};

interface CommandPaletteProps {
  userRole: UserRole;
  allowedPaths?: string[];
}

export function CommandPalette({ userRole, allowedPaths = [] }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<CommandPaletteResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const router = useRouter();
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);
  const createTaskModal = useCreateTaskModalSafe();
  const createProjectModal = useCreateProjectModalSafe();

  const canSearch = userRole === "ADMIN" || userRole === "DEVELOPER";
  const canCreateTasks = (userRole === "ADMIN" || userRole === "DEVELOPER") && createTaskModal !== null;
  const canCreateProjects = userRole === "ADMIN" && createProjectModal !== null;
  // Only offer pages this user still has access to
  const navigationItems = React.useMemo(() => {
    const items =
      userRole === "ADMIN"
        ? adminNavigationItems
        : userRole === "DEVELOPER"
          ? developerNavigationItems
          : clientNavigationItems;

    return items.filter(
      (item) => item.external || isPathAllowed(allowedPaths, item.href)
    );
  }, [userRole, allowedPaths]);

  // Listen for Cmd+K / Ctrl+K and C for create task
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K toggles command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      // C key opens create task modal (only when not typing in an input)
      if (
        e.key === "c" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        canCreateTasks &&
        !open
      ) {
        const target = e.target as HTMLElement;
        const isInputField =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest("[contenteditable]");

        if (!isInputField) {
          e.preventDefault();
          createTaskModal?.openCreateTaskModal();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canCreateTasks, createTaskModal, open]);

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setSearchResults([]);
    }
  }, [open]);

  // Debounced search (admin and developer only)
  React.useEffect(() => {
    if (!canSearch) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await searchCommandPalette(query);
        if (result.error) {
          console.error("Search error:", result.error);
        }
        setSearchResults(result.data || []);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, canSearch]);

  const handleSelect = (href: string, external?: boolean) => {
    setOpen(false);
    if (external) {
      window.open(href, "_blank", "noreferrer");
      return;
    }
    router.push(href);
  };

  // Filter navigation items based on query
  const filteredNavItems = React.useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) return navigationItems;

    return navigationItems.filter(
      (item) =>
        item.label.toLowerCase().includes(trimmedQuery) ||
        item.href.toLowerCase().includes(trimmedQuery) ||
        item.section.toLowerCase().includes(trimmedQuery) ||
        item.keywords?.some((keyword) => keyword.includes(trimmedQuery))
    );
  }, [navigationItems, query]);

  const matchesQuery = (label: string) => !query.trim() || label.includes(query.toLowerCase());
  const showCreateTask = canCreateTasks && matchesQuery("create task");
  const showCreateProject = canCreateProjects && matchesQuery("create project");

  // Group pages under their sidebar section so the admin list stays scannable
  const navSections = React.useMemo(() => {
    const sections = new Map<string, NavigationItem[]>();
    for (const item of filteredNavItems) {
      const existing = sections.get(item.section);
      if (existing) {
        existing.push(item);
      } else {
        sections.set(item.section, [item]);
      }
    }
    return Array.from(sections.entries());
  }, [filteredNavItems]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command shouldFilter={false}>
        <CommandInput
          placeholder={canSearch ? "Search pages or find items..." : "Go to page..."}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>
            {isSearching ? "Searching..." : "No results found."}
          </CommandEmpty>

          {/* Actions section */}
          {(showCreateTask || showCreateProject) && (
            <CommandGroup heading="Actions">
              {showCreateTask && (
                <CommandItem
                  value="create-task"
                  onSelect={() => {
                    setOpen(false);
                    createTaskModal?.openCreateTaskModal();
                  }}
                  className="flex items-center gap-3 py-2"
                >
                  <Plus className="size-4 text-secondary-500" />
                  <div className="flex flex-col">
                    <span>Create Task</span>
                    <span className="text-xs text-secondary-400">Create a new task</span>
                  </div>
                </CommandItem>
              )}
              {showCreateProject && (
                <CommandItem
                  value="create-project"
                  onSelect={() => {
                    setOpen(false);
                    createProjectModal?.openCreateProjectModal();
                  }}
                  className="flex items-center gap-3 py-2"
                >
                  <FolderGit2 className="size-4 text-secondary-500" />
                  <div className="flex flex-col">
                    <span>Create Project</span>
                    <span className="text-xs text-secondary-400">Create GitHub repo, Vercel project, and launch Cursor agent</span>
                  </div>
                </CommandItem>
              )}
            </CommandGroup>
          )}

          {(showCreateTask || showCreateProject) && navSections.length > 0 && <CommandSeparator />}

          {/* Go to pages, grouped by sidebar section */}
          {navSections.map(([section, items]) => (
            <CommandGroup key={section} heading={section}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={item.href}
                    onSelect={() => handleSelect(item.href, item.external)}
                    className="flex items-center gap-3 py-2"
                  >
                    <Icon className="size-4 text-secondary-500" />
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                      <span className="text-xs text-secondary-400">
                        {item.external ? "Public page, opens in a new tab" : "Page"}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}

          {/* Search results (admin and developer) */}
          {canSearch && searchResults.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Find">
                {searchResults.map((result) => {
                  const Icon = typeIcons[result.type];
                  return (
                    <CommandItem
                      key={`${result.type}-${result.id}`}
                      value={`${result.type}-${result.id}`}
                      onSelect={() => handleSelect(result.href)}
                      className="flex items-center gap-3 py-2"
                    >
                      <Icon className="size-4 text-secondary-500" />
                      <div className="flex flex-col">
                        <span className="line-clamp-1">{result.name}</span>
                        <span className="text-xs text-secondary-400">
                          {typeLabels[result.type]}
                          {result.subtitle && ` • ${result.subtitle}`}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>

        {/* Keyboard hint footer */}
        <div className="flex items-center justify-between border-t border-secondary-200 px-3 py-2 text-xs text-secondary-400">
          <div className="flex items-center gap-2">
            <kbd className="rounded border border-secondary-200 bg-secondary-50 px-1.5 py-0.5 font-mono text-[10px]">
              ↑↓
            </kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="rounded border border-secondary-200 bg-secondary-50 px-1.5 py-0.5 font-mono text-[10px]">
              ↵
            </kbd>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="rounded border border-secondary-200 bg-secondary-50 px-1.5 py-0.5 font-mono text-[10px]">
              esc
            </kbd>
            <span>Close</span>
          </div>
        </div>
      </Command>
    </CommandDialog>
  );
}
