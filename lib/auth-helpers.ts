import "server-only";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { User, UserRole } from "@prisma/client";

import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";

export const STAFF_ROLES: UserRole[] = [
  "OWNER",
  "ADMIN",
  "ACCOUNT_MANAGER",
  "SPECIALIST",
];

export async function getSessionUser(): Promise<User | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user || !user.isActive) redirect("/");
  return user;
}

export async function requireStaff(): Promise<User> {
  const user = await requireUser();
  if (!STAFF_ROLES.includes(user.role)) {
    const client = await prisma.client.findFirst({
      where: { portalUserId: user.id },
      select: { portalToken: true },
    });
    redirect(client ? `/portal/${client.portalToken}` : "/");
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

export function canManageTeam(role: UserRole) {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageIntegrations(role: UserRole) {
  return role === "OWNER" || role === "ADMIN";
}
