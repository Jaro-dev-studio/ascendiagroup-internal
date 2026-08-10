import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import FunnelPage from "./FunnelPage";

interface FunnelPageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: FunnelPageProps) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  const funnel = await prisma.funnel.findUnique({
    where: { id },
  });

  if (!funnel) {
    redirect("/dashboard");
  }

  return <FunnelPage params={{ id }} funnel={funnel} />;
}
