import { redirect } from "next/navigation";

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-helpers";

import { AuthClient } from "./client";

export default async function HomePage() {
  const user = await getSessionUser();

  if (user) {
    if (user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { portalUserId: user.id },
        select: { portalToken: true },
      });
      if (client) redirect(`/portal/${client.portalToken}`);
    } else {
      redirect("/dashboard");
    }
  }

  const userCount = await prisma.user.count();

  return <AuthClient needsSetup={userCount === 0} />;
}
