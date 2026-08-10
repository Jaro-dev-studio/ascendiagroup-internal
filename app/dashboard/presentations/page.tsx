import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPresentations } from "@/lib/fetchers";
import { PresentationsClient } from "./client";

export default async function PresentationsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  const { data: presentations, error } = await getPresentations();

  if (error) {
    throw new Error(error);
  }

  return <PresentationsClient presentations={presentations || []} />;
}
