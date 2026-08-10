import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Sidebar, SidebarSkeleton } from "./Sidebar";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { headers } from "next/headers";
import { JARO_DEV_INTERNAL_CLIENT_ID } from "@/lib/constants";
import { CommandPalette } from "@/components/command-palette";
import { GlobalAIChatButton } from "@/components/ai/GlobalAIChatButton";
import { getUpcomingCallsCountWithin16Hours } from "@/lib/fetchers";
import {
  getAllowedPagePaths,
  getLandingPath,
  isPathAllowed,
} from "@/lib/page-access/resolve";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      clientCompany: true,
    },
  });

  if (!user) {
    redirect("/");
  }

  // Resolve which pages this user can reach: role defaults plus per-user overrides
  const allowedPaths = await getAllowedPagePaths(user);

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";

  // Skip the check for exact /dashboard since page.tsx handles routing from there
  if (pathname && pathname !== "/dashboard" && !isPathAllowed(allowedPaths, pathname)) {
    redirect(getLandingPath(allowedPaths));
  }

  // Get pending action items count for client users (exclude pending admin review)
  let actionItemCount = 0;
  if (user.role === "CLIENT" && user.clientCompany) {
    actionItemCount = await prisma.actionItem.count({
      where: {
        clientCompanyId: user.clientCompany.id,
        status: {
          in: ["TODO", "IN_PROGRESS"],
        },
      },
    });
  }

  // Get submitted requests count for admin/developer users
  let submittedRequestsCount = 0;
  if (user.role === "ADMIN" || user.role === "DEVELOPER") {
    submittedRequestsCount = await prisma.request.count({
      where: {
        status: "SUBMITTED",
      },
    });
  }

  // Get pending admin review action items count for admins and developers.
  // Developers exclude the Jaro.dev internal client, matching what they see on the page.
  let pendingActionItemsCount = 0;
  if (user.role === "ADMIN") {
    pendingActionItemsCount = await prisma.actionItem.count({
      where: {
        status: "PENDING_ADMIN_REVIEW",
      },
    });
  } else if (user.role === "DEVELOPER") {
    pendingActionItemsCount = await prisma.actionItem.count({
      where: {
        status: "PENDING_ADMIN_REVIEW",
        clientCompanyId: { not: JARO_DEV_INTERNAL_CLIENT_ID },
      },
    });
  }

  // Get upcoming calls count within 16 hours for admins
  let upcomingCallsCount = 0;
  if (user.role === "ADMIN") {
    const { data: count } = await getUpcomingCallsCountWithin16Hours();
    upcomingCallsCount = count;
  }

  // Get product builds awaiting approval for admins
  let queuedBuildsCount = 0;
  if (user.role === "ADMIN") {
    queuedBuildsCount = await prisma.demo.count({
      where: { status: "queued" },
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle background pattern */}
      <div className="bg-grid-pattern pointer-events-none fixed inset-0 opacity-[0.01]" />
      
      {/* Command Palette */}
      <CommandPalette userRole={user.role} allowedPaths={allowedPaths} />
      
      {/* Global AI Chat */}
      <GlobalAIChatButton />
      
      <div className="relative z-10 flex min-h-screen">
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar user={user} actionItemCount={actionItemCount} submittedRequestsCount={submittedRequestsCount} pendingActionItemsCount={pendingActionItemsCount} upcomingCallsCount={upcomingCallsCount} queuedBuildsCount={queuedBuildsCount} allowedPaths={allowedPaths} />
        </Suspense>
        <main className="flex-1 overflow-y-auto px-6 pb-6 pt-16 lg:ml-64 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
