"use client";

import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Menu, 
  LogOut, 
  Users, 
  X,
  BarChart3,
  Building2,
  FileText,
  FileSpreadsheet,
  Activity,
  Lightbulb,
  Bug,
  CheckSquare,
  ListTodo,
  MessageSquarePlus,
  UserCircle,
  Bell,
  PlayCircle,
  Image,
  Phone,
  CalendarClock,
  Tag,
  Code,
  ClipboardList,
  Repeat,
  LayoutDashboard,
  GitBranch,
  ChevronDown,
  Star,
  Rocket,
  Presentation,
  Landmark,
  BookOpen,
  MailPlus,
  Contact,
  Handshake,
  Send,
  Video,
  ShieldCheck,
  BadgeDollarSign,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isPathAllowed } from "@/lib/page-access/match";
import { User } from "@prisma/client";
import { Button } from "@/components/ui/button";

const STARRED_PAGES_KEY = "jaro-studio-starred-pages";
const EXPANDED_SECTIONS_KEY = "jaro-studio-expanded-sections";

interface UserWithCompany extends User {
  clientCompany: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  // Public pages outside the dashboard: opened in a new tab and exempt from
  // page-access filtering, since only access-controlled pages live in allowedPaths.
  external?: boolean;
}

interface AdminNavSection {
  title: string;
  items: AdminNavItem[];
}

const adminNavigationSections: AdminNavSection[] = [
  {
    title: "Advertising",
    items: [
      {
        href: "/dashboard/case-studies",
        label: "Case Studies",
        icon: FileText,
      },
      {
        href: "/dashboard/offers",
        label: "Offers",
        icon: Tag,
      },
      {
        href: "/dashboard/submissions",
        label: "Form Submissions",
        icon: FileSpreadsheet,
      },
      {
        href: "/dashboard/live-funnel",
        label: "Live Funnel",
        icon: Activity,
      },
      {
        href: "/dashboard/ads",
        label: "Ads",
        icon: Image,
      },
    ],
  },
  {
    title: "Sales",
    items: [
      {
        href: "/dashboard/upcoming-calls",
        label: "Upcoming Calls",
        icon: CalendarClock,
      },
      {
        href: "/dashboard/sales-call-maps",
        label: "Call Maps",
        icon: ClipboardList,
      },
      {
        href: "/dashboard/mvp-call-maps",
        label: "MVP Call Maps",
        icon: Rocket,
      },
      {
        href: "/dashboard/demos",
        label: "Products",
        icon: Code,
      },
      {
        href: "/businessos-pricing",
        label: "Pricing Page",
        icon: BadgeDollarSign,
        external: true,
      },
    ],
  },
  {
    title: "CRM",
    items: [
      {
        href: "/dashboard/crm/people",
        label: "People",
        icon: Contact,
      },
      {
        href: "/dashboard/crm/companies",
        label: "Accounts",
        icon: Building2,
      },
      {
        href: "/dashboard/crm/deals",
        label: "Deals",
        icon: Handshake,
      },
      {
        href: "/dashboard/crm/sequences",
        label: "Sequences",
        icon: Send,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        href: "/dashboard/tasks",
        label: "Tasks",
        icon: ListTodo,
      },
      {
        href: "/dashboard/clients",
        label: "Clients",
        icon: Building2,
      },
      {
        href: "/dashboard/calls",
        label: "Past Calls",
        icon: Phone,
      },
      {
        href: "/dashboard/action-items",
        label: "Action Items",
        icon: CheckSquare,
      },
      {
        href: "/dashboard/feature-requests",
        label: "Requests",
        icon: MessageSquarePlus,
      },
      {
        href: "/dashboard/workflow-maps",
        label: "Workflow Maps",
        icon: GitBranch,
      },
    ],
  },
  {
    title: "Admin",
    items: [
      {
        href: "/dashboard/users",
        label: "Users",
        icon: Users,
      },
      {
        href: "/dashboard/page-access",
        label: "Page Access",
        icon: ShieldCheck,
      },
      {
        href: "/dashboard/notifications",
        label: "Notifications",
        icon: Bell,
      },
      {
        href: "/dashboard/recurring-tasks",
        label: "Recurring Tasks",
        icon: Repeat,
      },
      {
        href: "/dashboard/calculation",
        label: "Calculations",
        icon: BarChart3,
      },
      {
        href: "/dashboard/presentations",
        label: "Presentations",
        icon: Presentation,
      },
      {
        href: "/dashboard/sam-gov",
        label: "SAM.gov",
        icon: Landmark,
      },
      {
        href: "/dashboard/knowledge-base",
        label: "Knowledge Base",
        icon: BookOpen,
      },
      {
        href: "/dashboard/settings/followup-templates",
        label: "Followup Templates",
        icon: MailPlus,
      },
      {
        href: "/dashboard/crm/recording-rules",
        label: "Recording Rules",
        icon: Video,
      },
    ],
  },
];

const clientNavigationItems = [
  {
    href: "/dashboard/client-tasks",
    label: "Jaro.dev Tasks",
    icon: ListTodo,
  },
  {
    href: "/dashboard/client-action-items",
    label: "Action Items",
    icon: CheckSquare,
    showCounter: true,
  },
  {
    href: "/dashboard/feature-requests",
    label: "Feature Requests",
    icon: Lightbulb,
  },
  {
    href: "/dashboard/bug-requests",
    label: "Bug Fix Requests",
    icon: Bug,
  },
  {
    href: "/dashboard/studio-bug-report",
    label: "Studio Platform Bug Report",
    icon: Bug,
  },
];

const developerNavigationItems = [
  {
    href: "/dashboard/tasks",
    label: "Tasks",
    icon: ListTodo,
  },
  {
    href: "/dashboard/action-items",
    label: "Action Items",
    icon: CheckSquare,
    showPendingActionItemsCounter: true,
  },
  {
    href: "/dashboard/feature-requests",
    label: "Requests",
    icon: MessageSquarePlus,
    showRequestsCounter: true,
  },
  {
    href: "/dashboard/studio-bug-report",
    label: "Studio Platform Bug Report",
    icon: Bug,
  },
];

interface SidebarProps {
  user: UserWithCompany | null;
  actionItemCount?: number;
  submittedRequestsCount?: number;
  pendingActionItemsCount?: number;
  upcomingCallsCount?: number;
  queuedBuildsCount?: number;
  allowedPaths?: string[];
}

// Helper to get all navigation items flattened for starred lookup
const getAllAdminNavItems = () => {
  return adminNavigationSections.flatMap(section => section.items);
};

export function Sidebar({ user, actionItemCount = 0, submittedRequestsCount = 0, pendingActionItemsCount = 0, upcomingCallsCount = 0, queuedBuildsCount = 0, allowedPaths = [] }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [starredPages, setStarredPages] = useState<string[]>([]);
  const pathname = usePathname();

  // Load starred pages and expanded sections from localStorage
  useEffect(() => {
    const storedStarred = localStorage.getItem(STARRED_PAGES_KEY);
    if (storedStarred) {
      try {
        const parsed = JSON.parse(storedStarred);
        setStarredPages(parsed);
      } catch {
        setStarredPages([]);
      }
    }

    const storedExpanded = localStorage.getItem(EXPANDED_SECTIONS_KEY);
    if (storedExpanded) {
      try {
        const parsed = JSON.parse(storedExpanded);
        setExpandedSections(new Set(parsed));
      } catch {
        setExpandedSections(new Set());
      }
    }
  }, []);

  // Auto-expand section containing active route (only if not already loaded from localStorage)
  useEffect(() => {
    if (pathname && user?.role === "ADMIN") {
      const storedExpanded = localStorage.getItem(EXPANDED_SECTIONS_KEY);
      // Only auto-expand if there's no stored preference
      if (!storedExpanded) {
        const activeSection = adminNavigationSections.find(section =>
          section.items.some(item => pathname === item.href || pathname.startsWith(item.href + "/"))
        );
        if (activeSection) {
          setExpandedSections(prev => {
            const next = new Set([...prev, activeSection.title]);
            localStorage.setItem(EXPANDED_SECTIONS_KEY, JSON.stringify([...next]));
            return next;
          });
        }
      }
    }
  }, [pathname, user?.role]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSection = useCallback((title: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      localStorage.setItem(EXPANDED_SECTIONS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const toggleStar = useCallback((href: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStarredPages(prev => {
      const next = prev.includes(href) 
        ? prev.filter(p => p !== href)
        : [...prev, href];
      localStorage.setItem(STARRED_PAGES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isStarred = useCallback((href: string) => starredPages.includes(href), [starredPages]);

  const canAccess = useCallback(
    (href: string) => isPathAllowed(allowedPaths, href),
    [allowedPaths]
  );

  // Hide anything the admin has revoked for this user
  const visibleAdminSections = useMemo(
    () =>
      adminNavigationSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) => item.external || canAccess(item.href)
          ),
        }))
        .filter((section) => section.items.length > 0),
    [canAccess]
  );

  const visibleClientItems = useMemo(
    () => clientNavigationItems.filter((item) => canAccess(item.href)),
    [canAccess]
  );

  const visibleDeveloperItems = useMemo(
    () => developerNavigationItems.filter((item) => canAccess(item.href)),
    [canAccess]
  );

  if(!user){
    return null;
  }

  const isActive = (href: string) => {
    if (!pathname) return false;
    // Exact match
    if (pathname === href) return true;
    // Match if pathname starts with href followed by a slash (sub-route)
    return pathname.startsWith(href + "/");
  };

  // Get starred items for admin navigation
  const starredItems = user.role === "ADMIN" 
    ? getAllAdminNavItems().filter(item => starredPages.includes(item.href) && canAccess(item.href))
    : [];

  return (
    <>
      {/* Mobile Menu Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          size="icon"
          className="fixed left-4 top-4 z-50 lg:hidden"
        >
          <Menu className="size-4" />
        </Button>
      )}

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-secondary-200 bg-white lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-secondary-200 px-4">
          <div className="flex items-center gap-2">
            {user.role === "CLIENT" && user.clientCompany ? (
              <>
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary-500">
                  <Building2 className="size-3.5 text-white" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-primary-600">{user.clientCompany.name}</h1>
                  <p className="-mt-0.5 text-xs text-secondary-500">Jaro.dev Studio</p>
                </div>
              </>
            ) : (
              <>
                <img
                  src="/logo.png"
                  alt="Jaro.dev"
                  width={28}
                  height={28}
                  className="rounded-lg"
                />
                <div>
                  <h1 className="text-sm font-semibold text-primary-600">Jaro.dev</h1>
                  <p className="-mt-0.5 text-xs text-secondary-500">Studio</p>
                </div>
              </>
            )}
          </div>
          
          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="icon"
            className="size-6 lg:hidden"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <nav className="space-y-1">
            {user.role === "CLIENT" ? (
              // Client navigation - flat list
              visibleClientItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-md transition-colors",
                      active
                        ? "bg-primary-50 text-primary-700"
                        : "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
                    )}
                  >
                    {active && (
                      <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary-500" />
                    )}
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.showCounter && actionItemCount > 0 && (
                      <span className="flex size-5 items-center justify-center rounded-full bg-danger-500 text-xs font-medium text-white">
                        {actionItemCount > 99 ? "99+" : actionItemCount}
                      </span>
                    )}
                  </Link>
                );
              })
            ) : user.role === "DEVELOPER" ? (
              // Developer navigation - flat list with requests counter
              visibleDeveloperItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-md transition-colors",
                      active
                        ? "bg-primary-50 text-primary-700"
                        : "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
                    )}
                  >
                    {active && (
                      <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary-500" />
                    )}
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.showRequestsCounter && submittedRequestsCount > 0 && (
                      <span className="flex size-5 items-center justify-center rounded-full bg-danger-500 text-xs font-medium text-white">
                        {submittedRequestsCount > 99 ? "99+" : submittedRequestsCount}
                      </span>
                    )}
                    {item.showPendingActionItemsCounter && pendingActionItemsCount > 0 && (
                      <span className="flex size-5 items-center justify-center rounded-full bg-danger-500 text-xs font-medium text-white">
                        {pendingActionItemsCount > 99 ? "99+" : pendingActionItemsCount}
                      </span>
                    )}
                  </Link>
                );
              })
            ) : (
              // Admin navigation - sectioned with collapsible dropdowns
              <>
                {/* Overview - standalone link */}
                {canAccess("/dashboard/overview") && (
                  <Link
                    href="/dashboard/overview"
                    className={cn(
                      "relative flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-md transition-colors mb-2",
                      isActive("/dashboard/overview")
                        ? "bg-primary-50 text-primary-700"
                        : "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
                    )}
                  >
                    {isActive("/dashboard/overview") && (
                      <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary-500" />
                    )}
                    <LayoutDashboard className="size-4 shrink-0" />
                    <span className="flex-1">Overview</span>
                  </Link>
                )}

                {/* Starred Section */}
                {starredItems.length > 0 && (
                  <div className="mb-2 border-b border-secondary-200 pb-2">
                    <button
                      onClick={() => toggleSection("Starred")}
                      className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-secondary-400 transition-colors hover:text-secondary-600"
                    >
                      <span className="flex items-center gap-1.5">
                        <Star className="size-3 fill-warning-500 text-warning-500" />
                        Starred
                      </span>
                      <motion.div
                        animate={{ rotate: expandedSections.has("Starred") ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="size-3.5" />
                      </motion.div>
                    </button>
                    <AnimatePresence initial={false}>
                      {expandedSections.has("Starred") && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          {starredItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            const showRequestsCounter = item.href === "/dashboard/feature-requests" && submittedRequestsCount > 0;
                            const showPendingActionItemsCounter = item.href === "/dashboard/action-items" && pendingActionItemsCount > 0;
                            const showUpcomingCallsCounter = item.href === "/dashboard/upcoming-calls" && upcomingCallsCount > 0;
                            const showQueuedBuildsCounter = item.href === "/dashboard/demos" && queuedBuildsCount > 0;
                            
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                  "group relative flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-md transition-colors",
                                  active
                                    ? "bg-primary-50 text-primary-700"
                                    : "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
                                )}
                              >
                                {active && (
                                  <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary-500" />
                                )}
                                <Icon className="size-4 shrink-0" />
                                <span className="flex-1">{item.label}</span>
                                {showRequestsCounter && (
                                  <span className="flex size-5 items-center justify-center rounded-full bg-danger-500 text-xs font-medium text-white">
                                    {submittedRequestsCount > 99 ? "99+" : submittedRequestsCount}
                                  </span>
                                )}
                                {showPendingActionItemsCounter && (
                                  <span className="flex size-5 items-center justify-center rounded-full bg-danger-500 text-xs font-medium text-white">
                                    {pendingActionItemsCount > 99 ? "99+" : pendingActionItemsCount}
                                  </span>
                                )}
                                {showUpcomingCallsCounter && (
                                  <span className="flex size-5 items-center justify-center rounded-full bg-danger-500 text-xs font-medium text-white">
                                    {upcomingCallsCount > 99 ? "99+" : upcomingCallsCount}
                                  </span>
                                )}
                                {showQueuedBuildsCounter && (
                                  <span className="flex size-5 items-center justify-center rounded-full bg-danger-500 text-xs font-medium text-white">
                                    {queuedBuildsCount > 99 ? "99+" : queuedBuildsCount}
                                  </span>
                                )}
                                <button
                                  onClick={(e) => toggleStar(item.href, e)}
                                  className="opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                  <Star className="size-3.5 fill-warning-500 text-warning-500" />
                                </button>
                              </Link>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Regular Sections */}
                {visibleAdminSections.map((section, sectionIndex) => {
                  const isExpanded = expandedSections.has(section.title);
                  const hasActiveItem = section.items.some(item => isActive(item.href));
                  
                  // Check if any child in this section has a notification count
                  const hasNotificationInSection = section.items.some(item => {
                    if (item.href === "/dashboard/feature-requests" && submittedRequestsCount > 0) return true;
                    if (item.href === "/dashboard/action-items" && pendingActionItemsCount > 0) return true;
                    if (item.href === "/dashboard/upcoming-calls" && upcomingCallsCount > 0) return true;
                    if (item.href === "/dashboard/demos" && queuedBuildsCount > 0) return true;
                    return false;
                  });
                  
                  return (
                    <div
                      key={section.title}
                      className={cn(
                        sectionIndex > 0 && "mt-2 border-t border-secondary-200 pt-2"
                      )}
                    >
                      <button
                        onClick={() => toggleSection(section.title)}
                        className={cn(
                          "flex w-full items-center justify-between px-2 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors rounded-md",
                          hasActiveItem && !isExpanded
                            ? "text-primary-600"
                            : "text-secondary-400 hover:text-secondary-600"
                        )}
                      >
                        <span>{section.title}</span>
                        <div className="flex items-center gap-1">
                          {hasNotificationInSection && !isExpanded && (
                            <div className="size-1.5 rounded-full bg-danger-500" />
                          )}
                          {hasActiveItem && !isExpanded && !hasNotificationInSection && (
                            <div className="size-1.5 rounded-full bg-primary-500" />
                          )}
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="size-3.5" />
                          </motion.div>
                        </div>
                      </button>
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            {section.items.map((item) => {
                              const Icon = item.icon;
                              const active = isActive(item.href);
                              const starred = isStarred(item.href);
                              const showRequestsCounter = item.href === "/dashboard/feature-requests" && submittedRequestsCount > 0;
                              const showPendingActionItemsCounter = item.href === "/dashboard/action-items" && pendingActionItemsCount > 0;
                              const showUpcomingCallsCounter = item.href === "/dashboard/upcoming-calls" && upcomingCallsCount > 0;
                              const showQueuedBuildsCounter = item.href === "/dashboard/demos" && queuedBuildsCount > 0;
                              
                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  target={item.external ? "_blank" : undefined}
                                  rel={item.external ? "noreferrer" : undefined}
                                  className={cn(
                                    "group relative flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-md transition-colors",
                                    active
                                      ? "bg-primary-50 text-primary-700"
                                      : "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
                                  )}
                                >
                                  {active && (
                                    <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary-500" />
                                  )}
                                  <Icon className="size-4 shrink-0" />
                                  <span className="flex-1">{item.label}</span>
                                  {showRequestsCounter && (
                                    <span className="flex size-5 items-center justify-center rounded-full bg-danger-500 text-xs font-medium text-white">
                                      {submittedRequestsCount > 99 ? "99+" : submittedRequestsCount}
                                    </span>
                                  )}
                                  {showPendingActionItemsCounter && (
                                    <span className="flex size-5 items-center justify-center rounded-full bg-danger-500 text-xs font-medium text-white">
                                      {pendingActionItemsCount > 99 ? "99+" : pendingActionItemsCount}
                                    </span>
                                  )}
                                  {showUpcomingCallsCounter && (
                                    <span className="flex size-5 items-center justify-center rounded-full bg-danger-500 text-xs font-medium text-white">
                                      {upcomingCallsCount > 99 ? "99+" : upcomingCallsCount}
                                    </span>
                                  )}
                                  {showQueuedBuildsCounter && (
                                    <span className="flex size-5 items-center justify-center rounded-full bg-danger-500 text-xs font-medium text-white">
                                      {queuedBuildsCount > 99 ? "99+" : queuedBuildsCount}
                                    </span>
                                  )}
                                  <button
                                    onClick={(e) => toggleStar(item.href, e)}
                                    className={cn(
                                      "transition-opacity",
                                      starred ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                    )}
                                  >
                                    <Star 
                                      className={cn(
                                        "size-3.5",
                                        starred 
                                          ? "fill-warning-500 text-warning-500" 
                                          : "text-secondary-400 hover:text-warning-500"
                                      )} 
                                    />
                                  </button>
                                </Link>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </>
            )}
          </nav>
        </div>

        {/* Bottom Navigation Links */}
        <div className="mt-auto border-t border-secondary-200 p-3">
          <nav className="flex flex-col gap-1">
            {/* Tutorials - Only for clients */}
            {user.role === "CLIENT" && canAccess("/dashboard/tutorials") && (
              <Link
                href="/dashboard/tutorials"
                className={cn(
                  "relative flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-md transition-colors",
                  isActive("/dashboard/tutorials")
                    ? "bg-primary-50 text-primary-700"
                    : "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
                )}
              >
                {isActive("/dashboard/tutorials") && (
                  <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary-500" />
                )}
                <PlayCircle className="size-4 shrink-0" />
                <span>Tutorials</span>
              </Link>
            )}
            
            {/* Profile Settings */}
            <Link
              href="/dashboard/profile"
              className={cn(
                "relative flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-md transition-colors",
                isActive("/dashboard/profile")
                  ? "bg-primary-50 text-primary-700"
                  : "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
              )}
            >
              {isActive("/dashboard/profile") && (
                <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary-500" />
              )}
              <UserCircle className="size-4 shrink-0" />
              <span>Profile Settings</span>
            </Link>
          </nav>
        </div>

        {/* User Profile - Now floats at bottom */}
        <div className="border-t border-secondary-200 p-3">
          <div className="flex items-center gap-2 rounded-lg bg-secondary-50 p-2">
            <div className="relative">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary-500 text-sm font-medium text-white">
                {user.firstName ? user.firstName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-success-500" />
            </div>
            
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-secondary-900">
                {user.firstName && user.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user.email.split("@")[0]}
              </p>
              <p className="truncate text-xs text-secondary-500">
                {user.email}
              </p>
            </div>

            <Button
              onClick={() => signOut({callbackUrl: "/"})}
              variant="ghost"
              size="icon"
              className="size-6 text-secondary-400 hover:text-danger-600"
              title="Sign out"
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="fixed left-0 top-0 z-30 h-full w-64 border-r border-border bg-background">
      <div className="flex h-full flex-col">
        {/* Logo Section Skeleton */}
        <div className="flex h-16 items-center gap-2 border-b border-border px-4">
          <div className="size-8 animate-pulse rounded-lg bg-background-secondary" />
          <div className="h-4 w-24 animate-pulse rounded bg-background-secondary" />
        </div>

        {/* Navigation Links Skeleton */}
        <div className="flex-1 space-y-2 p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-4 animate-pulse rounded bg-background-secondary" />
              <div className="h-4 w-32 animate-pulse rounded bg-background-secondary" />
            </div>
          ))}
        </div>

        {/* User Profile Section Skeleton */}
        <div className="shrink-0 border-t border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="size-8 animate-pulse rounded-full bg-background-secondary" />
              <div className="flex flex-col gap-1">
                <div className="h-4 w-24 animate-pulse rounded bg-background-secondary" />
                <div className="h-3 w-32 animate-pulse rounded bg-background-secondary" />
              </div>
            </div>
            <div className="size-4 animate-pulse rounded bg-background-secondary" />
          </div>
        </div>
      </div>
    </div>
  );
}
