import prisma from "@/lib/prisma";

interface FetchResult<T> {
  data: T | null;
  error: string | null;
}

export async function getFollowupTemplates(): Promise<
  FetchResult<
    Array<{
      id: string;
      name: string;
      prompt: string;
      createdAt: Date;
      updatedAt: Date;
    }>
  >
  > {
  try {
    const templates = await prisma.followupTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { data: templates, error: null };
  } catch (error) {
    console.error("Error fetching followup templates:", error);
    return { data: null, error: "Failed to fetch followup templates" };
  }
}

export async function getMeetingFollowups(meetingId: string): Promise<
  FetchResult<
    Array<{
      id: string;
      content: string;
      status: string;
      sentTo: string | null;
      sentAt: Date | null;
      createdAt: Date;
      template: {
        id: string;
        name: string;
      };
    }>
  >
> {
  try {
    const followups = await prisma.meetingFollowup.findMany({
      where: { meetingId },
      orderBy: { createdAt: "desc" },
      include: {
        template: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return { data: followups, error: null };
  } catch (error) {
    console.error("Error fetching meeting followups:", error);
    return { data: null, error: "Failed to fetch meeting followups" };
  }
}

export async function getAllMeetingFollowups(meetingIds?: string[]): Promise<
  FetchResult<
    Record<
      string,
      Array<{
        id: string;
        content: string;
        status: string;
        sentTo: string | null;
        sentAt: Date | null;
        createdAt: Date;
        template: {
          id: string;
          name: string;
        };
      }>
    >
  >
  > {
  try {
    const followups = await prisma.meetingFollowup.findMany({
      where: meetingIds ? { meetingId: { in: meetingIds } } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        template: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const grouped: Record<string, typeof followups> = {};
    for (const followup of followups) {
      if (!grouped[followup.meetingId]) {
        grouped[followup.meetingId] = [];
      }
      grouped[followup.meetingId].push(followup);
    }

    return { data: grouped, error: null };
  } catch (error) {
    console.error("Error fetching all meeting followups:", error);
    return { data: null, error: "Failed to fetch meeting followups" };
  }
}
