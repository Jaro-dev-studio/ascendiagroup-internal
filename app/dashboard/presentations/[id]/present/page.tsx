import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPresentation } from "@/lib/fetchers";
import { PresentViewerClient } from "./client";

export default async function PresentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const { data: presentation, error } = await getPresentation(id);

  if (error || !presentation) {
    throw new Error(error || "Presentation not found");
  }

  return <PresentViewerClient presentation={presentation} />;
}
