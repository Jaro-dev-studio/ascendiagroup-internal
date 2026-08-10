import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { NotificationsClient } from "./client";
import { getClientNotificationSettings } from "@/lib/actions";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    redirect("/");
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { data: settings, error } = await getClientNotificationSettings();

  if (error || !settings) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-danger-700">
          Failed to load notification settings: {error || "Unknown error"}
        </div>
      </div>
    );
  }

  return <NotificationsClient initialSettings={settings} />;
}
