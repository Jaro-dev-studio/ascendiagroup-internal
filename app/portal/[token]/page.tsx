import { Logo } from "@/components/logo";
import prisma from "@/lib/prisma";

import { PortalClient } from "./client";

export const metadata = { title: "Client portal" };

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  console.log("[Portal] loading client status page...");

  const client = await prisma.client.findUnique({
    where: { portalToken: token },
    include: {
      accountManager: { select: { name: true, email: true } },
      services: true,
      submissions: {
        orderBy: { invitedAt: "desc" },
        include: { form: { select: { name: true } } },
      },
      projects: {
        where: { status: { not: "COMPLETED" } },
        orderBy: { createdAt: "desc" },
        include: {
          tasks: {
            orderBy: [{ status: "asc" }, { dueDate: "asc" }],
            select: {
              id: true,
              title: true,
              status: true,
              dueDate: true,
            },
          },
        },
      },
      strategies: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          phases: {
            orderBy: { order: "asc" },
            include: { items: { orderBy: { order: "asc" } } },
          },
        },
      },
      reports: {
        where: { status: "PUBLISHED" },
        orderBy: { periodEnd: "desc" },
      },
      metrics: { orderBy: { periodStart: "desc" }, take: 12 },
    },
  });

  if (!client) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-card">
          <Logo className="justify-center" />
          <h1 className="mt-6 text-lg font-semibold text-secondary-900">
            This portal link is not valid
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask your account manager to send you a fresh link.
          </p>
        </div>
      </main>
    );
  }

  return <PortalClient client={client} />;
}
