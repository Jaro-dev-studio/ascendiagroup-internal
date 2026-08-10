import { getDemoBySlug } from "@/lib/fetchers";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { DemoViewer } from "./client";

interface DemoPageProps {
  params: Promise<{ slug: string }>;
}

export default async function DemoPage({ params }: DemoPageProps) {
  const { slug } = await params;
  const { data: demo, error } = await getDemoBySlug(slug);

  if (error || !demo) {
    notFound();
  }

  // Builds awaiting approval or rejected have nothing to show yet
  if (demo.status === "queued" || demo.status === "rejected") {
    notFound();
  }

  // Check if user is an admin
  let isAdmin = false;
  const session = await getServerSession(authOptions);
  
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });
    isAdmin = user?.role === "ADMIN";
  }

  return (
    <DemoViewer
      demoId={demo.id}
      demoName={demo.name}
      status={demo.status}
      vercelDeployUrl={demo.vercelDeployUrl}
      githubRepoUrl={demo.githubRepoUrl}
      githubRepoName={demo.githubRepoName}
      cursorAgentUrl={demo.cursorAgentUrl}
      errorMessage={demo.errorMessage}
      isAdmin={isAdmin}
    />
  );
}
