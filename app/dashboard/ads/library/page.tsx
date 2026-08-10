import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { AdLibraryClient } from "./client";

export default async function AdLibraryPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  // Get user to check role
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });

  // Only admins can access this page
  if (user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Fetch all ad library items
  const items = await prisma.adLibraryItem.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <AdLibraryClient initialItems={items} />;
}
