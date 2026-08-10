import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NewCaseStudyClient } from "./client";

export default async function NewCaseStudyPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  return <NewCaseStudyClient />;
}
