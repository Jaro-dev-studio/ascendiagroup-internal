import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { getCompanyWithMeetings } from "@/lib/fetchers";
import prisma from "@/lib/prisma";
import { ClientDetailClient } from "./client";

interface ClientDetailPageProps {
  params: Promise<{
    clientId: string;
  }>;
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  // Check if user is admin
  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { clientId } = await params;

  const { data: client, error } = await getCompanyWithMeetings(clientId);

  if (error) {
    throw new Error(error);
  }

  if (!client) {
    notFound();
  }

  return <ClientDetailClient client={client} />;
}
