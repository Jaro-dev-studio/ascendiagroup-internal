import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { ProfileClient } from "./client";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      clientCompany: {
        select: {
          id: true,
          name: true,
        },
      },
      createdAt: true,
    },
  });

  if (!user) {
    redirect("/");
  }

  return <ProfileClient user={user} />;
}
