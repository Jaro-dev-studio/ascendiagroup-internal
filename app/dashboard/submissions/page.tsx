import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getFormSubmissions } from "@/lib/fetchers";
import { SubmissionsClient } from "./client";

export default async function SubmissionsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  const { data: submissions, error } = await getFormSubmissions();

  if (error) {
    throw new Error(error);
  }

  return <SubmissionsClient submissions={submissions || []} />;
}
