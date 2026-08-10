import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import type { User } from "@prisma/client";

export async function getSessionUser(): Promise<User | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return prisma.user.findUnique({
    where: { email: session.user.email },
  });
}

export async function getAdminUser(): Promise<User | null> {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}
