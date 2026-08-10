import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getMeetings, getMeetingsCount, getClientCompanies } from "@/lib/fetchers";
import { getFollowupTemplates, getAllMeetingFollowups } from "@/lib/fetchers/followups";
import prisma from "@/lib/prisma";
import { CallsClient } from "./client";

const CALLS_PER_PAGE = 5;

interface CallsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function CallsPage({ searchParams }: CallsPageProps) {
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

  const { page } = await searchParams;
  const parsedPage = Number.parseInt(page ?? "1", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [meetingsResult, meetingsCountResult, templatesResult, companiesResult] = await Promise.all([
    getMeetings({ skip: (currentPage - 1) * CALLS_PER_PAGE, take: CALLS_PER_PAGE }),
    getMeetingsCount(),
    getFollowupTemplates(),
    getClientCompanies(),
  ]);

  if (meetingsResult.error) {
    throw new Error(meetingsResult.error);
  }

  const meetings = meetingsResult.data || [];

  const followupsResult = await getAllMeetingFollowups(meetings.map((meeting) => meeting.id));

  const clientCompanies = (companiesResult.data || []).map((company) => ({
    id: company.id,
    name: company.name,
  }));

  return (
    <CallsClient
      key={currentPage}
      meetings={meetings}
      followupTemplates={templatesResult.data || []}
      meetingFollowups={followupsResult.data || {}}
      clientCompanies={clientCompanies}
      currentPage={currentPage}
      pageSize={CALLS_PER_PAGE}
      totalCount={meetingsCountResult.data ?? meetings.length}
    />
  );
}
