import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { FollowupTemplatesClient } from "./client";

export default async function FollowupTemplatesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const templates = await prisma.followupTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { followups: true },
      },
    },
  });

  return <FollowupTemplatesClient templates={templates} />;
}
