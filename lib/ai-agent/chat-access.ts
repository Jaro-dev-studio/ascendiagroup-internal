import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import type { AgentUser } from "./run";

interface ChatAccessResult {
  user: AgentUser | null;
  status: number;
  error: string | null;
}

/** Chat is open to admins and developers; clients are blocked entirely. */
export async function getChatUser(): Promise<ChatAccessResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { user: null, status: 401, error: "Unauthorized" };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, role: true },
  });

  if (!user || user.role === "CLIENT") {
    return { user: null, status: 403, error: "Access denied" };
  }

  return { user, status: 200, error: null };
}
