import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { HomeClient } from "./client";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return <HomeClient />;
}
