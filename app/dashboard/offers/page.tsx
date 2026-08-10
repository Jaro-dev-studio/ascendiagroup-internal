import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getOffers } from "@/lib/fetchers";
import { OffersClient } from "./client";

export default async function OffersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  const { data: offers, error } = await getOffers();

  if (error) {
    throw new Error(error);
  }

  return <OffersClient offers={offers || []} />;
}
