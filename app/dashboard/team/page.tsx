import { requireAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

import { TeamClient } from "./client";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const admin = await requireAdmin();

  const [members, invites] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        jobTitle: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        _count: { select: { managedClients: true, assignedTasks: true } },
      },
    }),
    prisma.teamInvite.findMany({
      where: { acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      include: { invitedBy: { select: { name: true, email: true } } },
    }),
  ]);

  return <TeamClient members={members} invites={invites} currentUserId={admin.id} />;
}
