import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { getAllowedPagePaths, getLandingPath, isPathAllowed } from "@/lib/page-access/resolve";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    redirect("/");
  }

  const allowedPaths = await getAllowedPagePaths(user);

  // Prefer the role's usual landing page, falling back to whatever access allows
  const preferredLanding =
    user.role === "CLIENT"
      ? "/dashboard/client-tasks"
      : user.role === "DEVELOPER"
        ? "/dashboard/tasks"
        : "/dashboard/overview";

  if (isPathAllowed(allowedPaths, preferredLanding)) {
    redirect(preferredLanding);
  }

  redirect(getLandingPath(allowedPaths));
}
