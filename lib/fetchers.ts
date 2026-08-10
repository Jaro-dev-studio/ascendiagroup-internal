"use server";

import prisma from "@/lib/prisma";
import { isJaroDevTeamEmail } from "@/lib/constants";
import { getDedupeKey } from "@/lib/crm/recording-rules";
import { stripHtml } from "@/lib/knowledge-base/chunking";
import { parseAttendeeResponses } from "@/lib/integrations/google-calendar";
import type { AttendeeResponseStatus } from "@/lib/integrations/google-calendar";
import type { ResearchOpportunity } from "@/types/research";

// Client Company fetchers
export async function getClientCompanies() {
  try {
    const clientCompanies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        slackPublicChannelId: true,
        slackInternalChannelId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { data: clientCompanies, error: null };
  } catch (error) {
    console.error("Error fetching client companies:", error);
    return { data: null, error: "Failed to fetch client companies" };
  }
}

export async function getClientCompany(id: string) {
  try {
    const clientCompany = await prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    if (!clientCompany) {
      return { data: null, error: "Client company not found" };
    }

    return { data: clientCompany, error: null };
  } catch (error) {
    console.error("Error fetching client company:", error);
    return { data: null, error: "Failed to fetch client company" };
  }
}

export async function getCompanyWithMeetings(id: string) {
  try {
    const clientCompany = await prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            createdAt: true,
          },
        },
        meetings: {
          orderBy: {
            startTime: "desc",
          },
          select: {
            id: true,
            meetingId: true,
            callRecordingId: true,
            recordingUrl: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            participants: true,
            formattedTranscript: true,
            summary: true,
            nextStepsJaroDev: true,
            nextStepsClient: true,
            createdAt: true,
          },
        },
        tasks: {
          where: {
            status: {
              not: "DONE",
            },
          },
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
            meetingId: true,
            meeting: {
              select: {
                id: true,
                title: true,
              },
            },
            createdByJaroDevAutomation: true,
            createdBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        actionItems: {
          where: {
            status: {
              not: "DONE",
            },
          },
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
            meetingId: true,
            meeting: {
              select: {
                id: true,
                title: true,
              },
            },
            createdByJaroDevAutomation: true,
            createdBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: {
            users: true,
            tasks: true,
            actionItems: true,
            meetings: true,
          },
        },
      },
    });

    if (!clientCompany) {
      return { data: null, error: "Client company not found" };
    }

    return { data: clientCompany, error: null };
  } catch (error) {
    console.error("Error fetching client company with meetings:", error);
    return { data: null, error: "Failed to fetch client company" };
  }
}

// Case Study fetchers
export async function getCaseStudies() {
  try {
    const caseStudies = await prisma.caseStudy.findMany({
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return { data: caseStudies, error: null };
  } catch (error) {
    console.error("Error fetching case studies:", error);
    return { data: null, error: "Failed to fetch case studies" };
  }
}

export async function getCaseStudy(id: string) {
  try {
    const caseStudy = await prisma.caseStudy.findUnique({
      where: { id },
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!caseStudy) {
      return { data: null, error: "Case study not found" };
    }

    return { data: caseStudy, error: null };
  } catch (error) {
    console.error("Error fetching case study:", error);
    return { data: null, error: "Failed to fetch case study" };
  }
}

// Form Submissions fetcher
export async function getFormSubmissions() {
  try {
    const submissions = await prisma.embedFormSubmission.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    return { data: submissions, error: null };
  } catch (error) {
    console.error("Error fetching form submissions:", error);
    return { data: null, error: "Failed to fetch form submissions" };
  }
}

// User fetchers
export async function getUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        clientCompanyId: true,
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { data: users, error: null };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { data: null, error: "Failed to fetch users" };
  }
}

// Get users that can be assigned to tasks (ADMIN or DEVELOPER)
export async function getAssignableUsers() {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ["ADMIN", "DEVELOPER"],
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        role: true,
      },
      orderBy: {
        email: "asc",
      },
    });

    return { data: users, error: null };
  } catch (error) {
    console.error("Error fetching assignable users:", error);
    return { data: null, error: "Failed to fetch assignable users" };
  }
}

// Task fetchers
export async function getTasksByClientCompany(clientCompanyId: string) {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        clientCompanyId,
      },
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
        blockedByActionItems: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    return { data: tasks, error: null };
  } catch (error) {
    console.error("Error fetching tasks by client company:", error);
    return { data: null, error: "Failed to fetch tasks" };
  }
}

export async function getTasks() {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
          },
        },
        blockedByTasks: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        blockedByActionItems: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        attachments: {
          select: {
            id: true,
            name: true,
            url: true,
            type: true,
            size: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
        meeting: {
          select: {
            id: true,
            title: true,
            clientCompanyId: true,
          },
        },
        agentExecutions: {
          select: {
            id: true,
            githubRepoName: true,
            githubRepoUrl: true,
            prompt: true,
            cursorAgentId: true,
            cursorAgentUrl: true,
            cursorAgentStatus: true,
            prUrl: true,
            prNumber: true,
            branchName: true,
            summary: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    // Add createdByJaroDevAutomation to each task
    const tasksWithAutomation = tasks.map((task) => ({
      ...task,
      createdByJaroDevAutomation: task.createdByJaroDevAutomation,
    }));

    return { data: tasksWithAutomation, error: null };
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return { data: null, error: "Failed to fetch tasks" };
  }
}

export async function getTask(id: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
          },
        },
        blockedByTasks: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        blockedByActionItems: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!task) {
      return { data: null, error: "Task not found" };
    }

    return { data: task, error: null };
  } catch (error) {
    console.error("Error fetching task:", error);
    return { data: null, error: "Failed to fetch task" };
  }
}

// Action Item fetchers
export async function getActionItems() {
  try {
    const actionItems = await prisma.actionItem.findMany({
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    return { data: actionItems, error: null };
  } catch (error) {
    console.error("Error fetching action items:", error);
    return { data: null, error: "Failed to fetch action items" };
  }
}

export async function getActionItemsByClientCompany(clientCompanyId: string) {
  try {
    const actionItems = await prisma.actionItem.findMany({
      where: {
        clientCompanyId,
        // Exclude items pending admin review - clients should not see these
        status: {
          not: "PENDING_ADMIN_REVIEW",
        },
      },
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    return { data: actionItems, error: null };
  } catch (error) {
    console.error("Error fetching action items by client company:", error);
    return { data: null, error: "Failed to fetch action items" };
  }
}

// Request fetchers
export async function getRequests() {
  try {
    const requests = await prisma.request.findMany({
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    // Transform to include all fields including bug-specific ones
    const transformedRequests = requests.map((r) => ({
      ...r,
      stepsToReproduce: r.stepsToReproduce,
      expectedBehavior: r.expectedBehavior,
      bugSeverity: r.bugSeverity,
      screenRecordingUrl: r.screenRecordingUrl,
    }));

    return { data: transformedRequests, error: null };
  } catch (error) {
    console.error("Error fetching requests:", error);
    return { data: null, error: "Failed to fetch requests" };
  }
}

export async function getRequestsByClientCompany(clientCompanyId: string) {
  try {
    const requests = await prisma.request.findMany({
      where: {
        clientCompanyId,
      },
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    // Transform to include all fields including bug-specific ones
    const transformedRequests = requests.map((r) => ({
      ...r,
      stepsToReproduce: r.stepsToReproduce,
      expectedBehavior: r.expectedBehavior,
      bugSeverity: r.bugSeverity,
      screenRecordingUrl: r.screenRecordingUrl,
    }));

    return { data: transformedRequests, error: null };
  } catch (error) {
    console.error("Error fetching requests by client company:", error);
    return { data: null, error: "Failed to fetch requests" };
  }
}

export async function getRequest(id: string) {
  try {
    const request = await prisma.request.findUnique({
      where: { id },
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
            description: true,
          },
        },
      },
    });

    if (!request) {
      return { data: null, error: "Request not found" };
    }

    return { data: request, error: null };
  } catch (error) {
    console.error("Error fetching request:", error);
    return { data: null, error: "Failed to fetch request" };
  }
}

// Offer fetchers
export async function getOffers() {
  try {
    const offers = await prisma.offer.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return { data: offers, error: null };
  } catch (error) {
    console.error("Error fetching offers:", error);
    return { data: null, error: "Failed to fetch offers" };
  }
}

export async function getOffer(id: string) {
  try {
    const offer = await prisma.offer.findUnique({
      where: { id },
    });

    if (!offer) {
      return { data: null, error: "Offer not found" };
    }

    return { data: offer, error: null };
  } catch (error) {
    console.error("Error fetching offer:", error);
    return { data: null, error: "Failed to fetch offer" };
  }
}

// Meeting fetchers
export async function getMeetings(options?: { skip?: number; take?: number }) {
  try {
    const meetings = await prisma.meeting.findMany({
      orderBy: {
        startTime: "desc",
      },
      skip: options?.skip,
      take: options?.take,
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
            // Any non-rejected build blocks queueing another one for this client
            demos: {
              where: {
                status: { not: "rejected" },
              },
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                githubRepoUrl: true,
                vercelDeployUrl: true,
                cursorAgentUrl: true,
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
        tasks: {
          where: {
            status: {
              not: "DONE",
            },
          },
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
          },
        },
        actionItems: {
          where: {
            status: {
              not: "DONE",
            },
          },
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    return { data: meetings, error: null };
  } catch (error) {
    console.error("Error fetching meetings:", error);
    return { data: null, error: "Failed to fetch meetings" };
  }
}

export async function getMeetingsCount() {
  try {
    const count = await prisma.meeting.count();

    return { data: count, error: null };
  } catch (error) {
    console.error("Error counting meetings:", error);
    return { data: null, error: "Failed to count meetings" };
  }
}

// Demo fetchers
export async function getDemos() {
  try {
    const demos = await prisma.demo.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return { data: demos, error: null };
  } catch (error) {
    console.error("Error fetching demos:", error);
    return { data: null, error: "Failed to fetch demos" };
  }
}

export async function getDemoById(id: string) {
  try {
    const demo = await prisma.demo.findUnique({
      where: { id },
    });

    if (!demo) {
      return { data: null, error: "Demo not found" };
    }

    return { data: demo, error: null };
  } catch (error) {
    console.error("Error fetching demo:", error);
    return { data: null, error: "Failed to fetch demo" };
  }
}

export async function getDemoBySlug(slug: string) {
  try {
    const demo = await prisma.demo.findUnique({
      where: { slug },
    });

    if (!demo) {
      return { data: null, error: "Demo not found" };
    }

    return { data: demo, error: null };
  } catch (error) {
    console.error("Error fetching demo by slug:", error);
    return { data: null, error: "Failed to fetch demo" };
  }
}

/**
 * Get client companies that don't have demos yet
 */
export async function getClientCompaniesWithoutDemos() {
  try {
    const clientCompanies = await prisma.company.findMany({
      where: {
        // Rejected builds don't count, so those clients stay available for a manual build
        demos: {
          none: {
            status: { not: "rejected" },
          },
        },
      },
      include: {
        meetings: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            title: true,
            formattedTranscript: true,
          },
        },
        users: {
          take: 1,
          select: { email: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { data: clientCompanies, error: null };
  } catch (error) {
    console.error("Error fetching client companies without demos:", error);
    return { data: null, error: "Failed to fetch client companies" };
  }
}

/**
 * Get demos with client company info
 */
export async function getDemosWithClientInfo() {
  try {
    const demos = await prisma.demo.findMany({
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { data: demos, error: null };
  } catch (error) {
    console.error("Error fetching demos with client info:", error);
    return { data: null, error: "Failed to fetch demos" };
  }
}

// ============================================
// SALES CALL MAP FETCHERS
// ============================================

/**
 * Get all sales call maps with related data
 */
export async function getSalesCallMaps() {
  try {
    const salesCallMaps = await prisma.salesCallMap.findMany({
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
        meeting: {
          select: {
            id: true,
            title: true,
            startTime: true,
          },
        },
        formSubmission: {
          select: {
            id: true,
            name: true,
            email: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { data: salesCallMaps, error: null };
  } catch (error) {
    console.error("Error fetching sales call maps:", error);
    return { data: null, error: "Failed to fetch sales call maps" };
  }
}

/**
 * Get a single sales call map by ID with all related data
 */
export async function getSalesCallMap(id: string) {
  try {
    const salesCallMap = await prisma.salesCallMap.findUnique({
      where: { id },
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
            website: true,
            status: true,
          },
        },
        meeting: {
          select: {
            id: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            participants: true,
            summary: true,
          },
        },
        formSubmission: {
          select: {
            id: true,
            name: true,
            email: true,
            type: true,
            timeline: true,
            companyHeadcount: true,
            manualProcesses: true,
            budget: true,
            productType: true,
            platform: true,
            servicesNeeded: true,
            utmSource: true,
            utmCampaign: true,
            firstName: true,
            lastName: true,
            createdAt: true,
          },
        },
        sharedQuotes: {
          select: {
            id: true,
            token: true,
            companyName: true,
            total: true,
            onCallTotal: true,
            deposit: true,
            onCallDeposit: true,
            expiresAt: true,
            depositPaidAt: true,
            depositPaidAmount: true,
            viewCount: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!salesCallMap) {
      return { data: null, error: "Sales call map not found" };
    }

    return { data: salesCallMap, error: null };
  } catch (error) {
    console.error("Error fetching sales call map:", error);
    return { data: null, error: "Failed to fetch sales call map" };
  }
}

/**
 * Get form submissions for linking to sales call maps
 * Returns recent submissions that can be linked
 */
export async function getFormSubmissionsForLinking() {
  try {
    const submissions = await prisma.embedFormSubmission.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Limit to recent 100 submissions
    });

    return { data: submissions, error: null };
  } catch (error) {
    console.error("Error fetching form submissions for linking:", error);
    return { data: null, error: "Failed to fetch form submissions" };
  }
}

// ============================================
// UPCOMING CALLS (FROM CALENDLY API)
// ============================================

// Calendly API types
interface CalendlyUser {
  uri: string;
  name: string;
  email: string;
}

interface CalendlyEvent {
  uri: string;
  name: string;
  status: "active" | "canceled";
  start_time: string;
  end_time: string;
  event_type: string;
  location: {
    type: string;
    location?: string;
    join_url?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  status: string;
  created_at: string;
}

interface CalendlyScheduledEventsResponse {
  collection: CalendlyEvent[];
  pagination: {
    count: number;
    next_page: string | null;
    previous_page: string | null;
    next_page_token: string | null;
  };
}

interface CalendlyInviteesResponse {
  collection: CalendlyInvitee[];
  pagination: {
    count: number;
    next_page: string | null;
  };
}

export interface UpcomingCall {
  id: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  meetLink: string | null;
  participants: Array<{
    email: string;
    isOrganizer: boolean;
    /** How they answered the invite, null when Google has no answer on record. */
    responseStatus: AttendeeResponseStatus | null;
  }>;
  /**
   * The RSVP of the guest on the other end of the call. A decline is the signal
   * worth surfacing, so it wins when several guests answered differently.
   */
  leadResponseStatus: AttendeeResponseStatus | null;
  // Enriched data from our database
  clientCompany: {
    id: string;
    name: string;
  } | null;
  formSubmission: {
    id: string;
    name: string;
    email: string;
    timeline: string | null;
    companyHeadcount: string | null;
    manualProcesses: string | null;
    budget: string | null;
    productType: string | null;
    platform: string | null;
    servicesNeeded: string[];
  } | null;
  /** The automated research brief for the company on the other end of the call. */
  research: {
    companyId: string;
    companyName: string;
    summary: string | null;
    opportunities: ResearchOpportunity[];
    discoveryQuestions: string[];
  } | null;
}

interface UpcomingCalendarEvent {
  googleEventId: string;
  title: string | null;
  description: string | null;
  startTime: Date;
  endTime: Date;
  organizer: string | null;
  attendees: string[];
  attendeeResponses: unknown;
  meetingUrl: string | null;
  externalEmails: string[];
}

/**
 * Loads the meetings the calendar sync has pulled from the team's Google
 * calendars. This is the single source for anything "upcoming": it covers
 * Calendly bookings, which land on the calendar too, as well as meetings put in
 * by hand, which Calendly never knows about.
 *
 * Only meetings with a guest from outside the team are returned, so internal
 * standups stay out of a view meant for calls with leads and clients.
 */
async function loadUpcomingCalendarEvents(
  from: Date,
  to?: Date
): Promise<UpcomingCalendarEvent[]> {
  const events = await prisma.calendarEvent.findMany({
    where: {
      startTime: to ? { gte: from, lte: to } : { gte: from },
      isAllDay: false,
      status: { not: "cancelled" },
    },
    orderBy: { startTime: "asc" },
    select: {
      googleEventId: true,
      title: true,
      description: true,
      startTime: true,
      endTime: true,
      organizer: true,
      attendees: true,
      attendeeResponses: true,
      meetingUrl: true,
    },
  });

  // A meeting several of us are on syncs once per team calendar, so collapse
  // those rows before they reach the page as duplicates.
  const byEvent = new Map<string, UpcomingCalendarEvent>();

  for (const event of events) {
    const externalEmails = [...new Set(event.attendees)]
      .filter((email) => !isJaroDevTeamEmail(email))
      .map((email) => email.toLowerCase());

    if (externalEmails.length === 0) continue;

    const key = event.meetingUrl
      ? getDedupeKey(event.meetingUrl, event.startTime)
      : `${event.googleEventId}#${event.startTime.getTime()}`;

    if (byEvent.has(key)) continue;
    byEvent.set(key, { ...event, externalEmails });
  }

  return [...byEvent.values()];
}

/**
 * Upcoming meetings with people outside the team, enriched with whatever we
 * already know about the guest: their client company, the form they filled in,
 * and the research brief for it.
 */
export async function getUpcomingCalls(): Promise<{ data: UpcomingCall[] | null; error: string | null }> {
  try {
    // A call that started a moment ago is still the one you are about to join.
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    console.log("[UpcomingCalls] loading synced calendar events...");
    const calendarEvents = await loadUpcomingCalendarEvents(thirtyMinutesAgo);

    console.log(`[UpcomingCalls] ${calendarEvents.length} upcoming call(s) with external guests`);

    const externalEmails = new Set<string>();
    for (const event of calendarEvents) {
      for (const email of event.externalEmails) externalEmails.add(email);
    }

    const [users, formSubmissions] = await Promise.all([
      prisma.user.findMany({
        where: {
          email: {
            in: Array.from(externalEmails),
            mode: "insensitive",
          },
          clientCompanyId: { not: null },
        },
        select: {
          email: true,
          clientCompany: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.embedFormSubmission.findMany({
        where: {
          email: {
            in: Array.from(externalEmails),
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          timeline: true,
          companyHeadcount: true,
          manualProcesses: true,
          budget: true,
          productType: true,
          platform: true,
          servicesNeeded: true,
          company: {
            select: {
              id: true,
              name: true,
              researchSummary: true,
              researchOpportunities: true,
              researchDiscoveryQuestions: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    // Create lookup maps
    const emailToClientCompany = new Map<string, { id: string; name: string }>();
    for (const user of users) {
      if (user.clientCompany) {
        emailToClientCompany.set(user.email.toLowerCase(), user.clientCompany);
      }
    }

    const emailToFormSubmission = new Map<string, NonNullable<UpcomingCall["formSubmission"]>>();
    const researchByEmail = new Map<string, NonNullable<typeof formSubmissions[0]["company"]>>();
    for (const submission of formSubmissions) {
      const email = submission.email.toLowerCase();
      // Only store the first (most recent) submission for each email
      if (!emailToFormSubmission.has(email)) {
        const { company, ...rest } = submission;
        emailToFormSubmission.set(email, rest);
        if (company) researchByEmail.set(email, company);
      }
    }

    // Transform events to our format with enriched data
    const upcomingCalls: UpcomingCall[] = calendarEvents.map((event) => {
      // Find enrichment data from external participants
      let clientCompany: UpcomingCall["clientCompany"] = null;
      let formSubmission: UpcomingCall["formSubmission"] = null;

      for (const email of event.externalEmails) {
        if (!clientCompany) {
          clientCompany = emailToClientCompany.get(email) || null;
        }
        if (!formSubmission) {
          formSubmission = emailToFormSubmission.get(email) || null;
        }
        if (clientCompany && formSubmission) break;
      }

      const company = formSubmission ? researchByEmail.get(formSubmission.email.toLowerCase()) : null;

      const rsvpByEmail = new Map(
        parseAttendeeResponses(event.attendeeResponses).map((attendee) => [
          attendee.email.toLowerCase(),
          attendee.responseStatus,
        ])
      );

      // The organizer is not always repeated in the attendee list, so add them
      // back rather than showing a call with nobody hosting it.
      const emails = [...new Set(
        [...event.attendees, event.organizer]
          .filter((email): email is string => Boolean(email))
          .map((email) => email.toLowerCase())
      )];

      const participants = emails.map((email) => ({
        email,
        isOrganizer: email === event.organizer?.toLowerCase(),
        responseStatus: rsvpByEmail.get(email) ?? null,
      }));

      const guestResponses = participants
        .filter((participant) => !isJaroDevTeamEmail(participant.email))
        .map((participant) => participant.responseStatus)
        .filter((status): status is AttendeeResponseStatus => Boolean(status));

      const leadResponseStatus =
        guestResponses.find((status) => status === "declined") ??
        guestResponses.find((status) => status === "accepted") ??
        guestResponses[0] ??
        null;

      return {
        id: event.googleEventId,
        title: event.title || "Meeting",
        // Google stores invite descriptions as HTML; the dialog renders text.
        description: event.description ? stripHtml(event.description) : null,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: false,
        meetLink: event.meetingUrl,
        participants,
        leadResponseStatus,
        clientCompany,
        formSubmission,
        research: company
          ? {
            companyId: company.id,
            companyName: company.name,
            summary: company.researchSummary,
            opportunities: Array.isArray(company.researchOpportunities)
              ? (company.researchOpportunities as unknown as ResearchOpportunity[])
              : [],
            discoveryQuestions: company.researchDiscoveryQuestions,
          }
          : null,
      };
    });

    return { data: upcomingCalls, error: null };
  } catch (error) {
    console.error("Error fetching upcoming calls:", error);
    return { data: null, error: "Failed to fetch upcoming calls" };
  }
}

/**
 * Get count of upcoming calls within the next 16 hours
 * Lightweight version for sidebar indicator
 */
export async function getUpcomingCallsCountWithin16Hours(): Promise<{ data: number; error: string | null }> {
  try {
    const now = new Date();
    const sixteenHoursFromNow = new Date(now.getTime() + 16 * 60 * 60 * 1000);

    const events = await loadUpcomingCalendarEvents(now, sixteenHoursFromNow);

    return { data: events.length, error: null };
  } catch (error) {
    console.error("Error fetching upcoming calls count:", error);
    return { data: 0, error: "Failed to fetch upcoming calls count" };
  }
}

export interface UpcomingCallsSummary {
  totalCount: number;
  todayCount: number;
  nextCallStartTime: Date | null;
}

/**
 * Get a count summary of upcoming calls from now onwards
 * Lightweight version (no enrichment lookups) for dashboard KPI cards
 */
export async function getUpcomingCallsSummary(): Promise<{ data: UpcomingCallsSummary | null; error: string | null }> {
  try {
    const now = new Date();

    console.log("[UpcomingCallsSummary] loading synced calendar events...");
    const events = await loadUpcomingCalendarEvents(now);

    console.log(`[UpcomingCallsSummary] counting ${events.length} upcoming events...`);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const startTimes = events
      .map((event) => event.startTime)
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      data: {
        totalCount: startTimes.length,
        todayCount: startTimes.filter((startTime) => startTime <= endOfToday).length,
        nextCallStartTime: startTimes[0] || null,
      },
      error: null,
    };
  } catch (error) {
    console.error("[UpcomingCallsSummary] error fetching upcoming calls summary:", error);
    return { data: null, error: "Failed to fetch upcoming calls summary" };
  }
}

// Sales call event name to filter for scheduled calls
const SALES_CALL_EVENT_NAME = "You Qualify! Book Your Free Consultation";

export interface ScheduledSalesCall {
  id: string;
  eventName: string;
  startTime: Date;
  endTime: Date;
  status: string;
  inviteeEmail: string | null;
}

/**
 * Fetch all scheduled sales calls from Calendly API for a given time range
 * Only returns events matching the sales call event name
 */
export async function getScheduledSalesCalls(): Promise<{ data: ScheduledSalesCall[] | null; error: string | null }> {
  try {
    const apiToken = process.env.CALENDLY_PAT;
    if (!apiToken) {
      return { data: null, error: "CALENDLY_PAT not configured" };
    }

    const headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };

    // Step 1: Get current user to get user URI
    const userResponse = await fetch("https://api.calendly.com/users/me", {
      method: "GET",
      headers,
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.text();
      console.error("Calendly API error (get user):", userResponse.status, errorData);
      return { data: null, error: `Failed to get Calendly user: ${userResponse.status}` };
    }

    const userData: { resource: CalendlyUser } = await userResponse.json();
    const userUri = userData.resource.uri;

    // Step 2: Get scheduled events from the past year
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    
    const allEvents: CalendlyEvent[] = [];
    let nextPageToken: string | null = null;
    
    do {
      const eventsUrl = new URL("https://api.calendly.com/scheduled_events");
      eventsUrl.searchParams.set("user", userUri);
      eventsUrl.searchParams.set("min_start_time", oneYearAgo.toISOString());
      eventsUrl.searchParams.set("max_start_time", now.toISOString());
      eventsUrl.searchParams.set("sort", "start_time:desc");
      eventsUrl.searchParams.set("count", "100");
      if (nextPageToken) {
        eventsUrl.searchParams.set("page_token", nextPageToken);
      }

      const eventsResponse = await fetch(eventsUrl.toString(), {
        method: "GET",
        headers,
        next: { revalidate: 300 },
      });

      if (!eventsResponse.ok) {
        const errorData = await eventsResponse.text();
        console.error("Calendly API error (get events):", eventsResponse.status, errorData);
        return { data: null, error: `Failed to fetch events from Calendly: ${eventsResponse.status}` };
      }

      const eventsData: CalendlyScheduledEventsResponse = await eventsResponse.json();
      allEvents.push(...eventsData.collection);
      nextPageToken = eventsData.pagination.next_page_token;
    } while (nextPageToken);

    // Step 3: Filter events by the sales call event name and get invitee info
    const salesCallEvents = allEvents.filter(
      (event) => event.name === SALES_CALL_EVENT_NAME
    );

    // Get invitees for each sales call event
    const scheduledCalls: ScheduledSalesCall[] = await Promise.all(
      salesCallEvents.map(async (event) => {
        const eventUuid = event.uri.split("/").pop();
        let inviteeEmail: string | null = null;
        
        try {
          const inviteesUrl = `https://api.calendly.com/scheduled_events/${eventUuid}/invitees`;
          const inviteesResponse = await fetch(inviteesUrl, {
            method: "GET",
            headers,
            next: { revalidate: 300 },
          });

          if (inviteesResponse.ok) {
            const inviteesData: CalendlyInviteesResponse = await inviteesResponse.json();
            // Get the first invitee's email (there's usually just one for a 1:1 call)
            if (inviteesData.collection.length > 0) {
              inviteeEmail = inviteesData.collection[0].email.toLowerCase();
            }
          }
        } catch {
          // Ignore invitee fetch errors
        }

        return {
          id: eventUuid || event.uri,
          eventName: event.name,
          startTime: new Date(event.start_time),
          endTime: new Date(event.end_time),
          status: event.status,
          inviteeEmail,
        };
      })
    );

    return { data: scheduledCalls, error: null };
  } catch (error) {
    console.error("Error fetching scheduled sales calls:", error);
    return { data: null, error: "Failed to fetch scheduled sales calls" };
  }
}

// ============================================
// RECURRING TASKS
// ============================================

/**
 * Get all recurring tasks with related data
 */
export async function getRecurringTasks() {
  try {
    const recurringTasks = await prisma.recurringTask.findMany({
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { data: recurringTasks, error: null };
  } catch (error) {
    console.error("Error fetching recurring tasks:", error);
    return { data: null, error: "Failed to fetch recurring tasks" };
  }
}

/**
 * Get a single recurring task by ID
 */
export async function getRecurringTask(id: string) {
  try {
    const recurringTask = await prisma.recurringTask.findUnique({
      where: { id },
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
    });

    if (!recurringTask) {
      return { data: null, error: "Recurring task not found" };
    }

    return { data: recurringTask, error: null };
  } catch (error) {
    console.error("Error fetching recurring task:", error);
    return { data: null, error: "Failed to fetch recurring task" };
  }
}

// ============================================
// MVP CALL MAPS
// ============================================

/**
 * Get all MVP call maps with basic related data
 */
export async function getMVPCallMaps() {
  try {
    const mvpCallMaps = await prisma.mVPCallMap.findMany({
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
        formSubmission: {
          select: {
            id: true,
            name: true,
            email: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { data: mvpCallMaps, error: null };
  } catch (error) {
    console.error("Error fetching MVP call maps:", error);
    return { data: null, error: "Failed to fetch MVP call maps" };
  }
}

/**
 * Get a single MVP call map by ID with all related data
 */
export async function getMVPCallMap(id: string) {
  try {
    const mvpCallMap = await prisma.mVPCallMap.findUnique({
      where: { id },
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
            website: true,
            status: true,
          },
        },
        formSubmission: {
          select: {
            id: true,
            name: true,
            email: true,
            type: true,
            timeline: true,
            companyHeadcount: true,
            manualProcesses: true,
            budget: true,
            productType: true,
            platform: true,
            servicesNeeded: true,
            utmSource: true,
            utmCampaign: true,
            firstName: true,
            lastName: true,
            createdAt: true,
          },
        },
        sharedQuotes: {
          select: {
            id: true,
            token: true,
            companyName: true,
            total: true,
            deposit: true,
            expiresAt: true,
            depositPaidAt: true,
            depositPaidAmount: true,
            viewCount: true,
            milestones: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!mvpCallMap) {
      return { data: null, error: "MVP call map not found" };
    }

    return { data: mvpCallMap, error: null };
  } catch (error) {
    console.error("Error fetching MVP call map:", error);
    return { data: null, error: "Failed to fetch MVP call map" };
  }
}

// ============================================
// DEMO MODAL FETCHERS
// ============================================

/**
 * Get all meetings for the demo modal (for transcript selection)
 * Returns meetings with transcript info for linking to demos
 */
export async function getMeetingsForDemoModal() {
  try {
    const meetings = await prisma.meeting.findMany({
      select: {
        id: true,
        title: true,
        startTime: true,
        formattedTranscript: true,
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startTime: "desc",
      },
      take: 100, // Limit to recent 100 meetings
    });

    // Transform to include hasTranscript flag
    const meetingsWithFlag = meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      startTime: meeting.startTime,
      hasTranscript: !!meeting.formattedTranscript && meeting.formattedTranscript.length > 0,
      transcriptLength: meeting.formattedTranscript?.length || 0,
      clientCompany: meeting.clientCompany,
    }));

    return { data: meetingsWithFlag, error: null };
  } catch (error) {
    console.error("Error fetching meetings for demo modal:", error);
    return { data: null, error: "Failed to fetch meetings" };
  }
}

/**
 * Get all MVP shared quotes for the demo modal (for quote selection)
 * Returns quotes with basic info for linking to demos
 */
export async function getMVPSharedQuotesForDemoModal() {
  try {
    const quotes = await prisma.mVPSharedQuote.findMany({
      select: {
        id: true,
        token: true,
        companyName: true,
        total: true,
        deposit: true,
        productSummary: true,
        lineItems: true,
        expiresAt: true,
        createdAt: true,
        mvpCallMap: {
          select: {
            id: true,
            name: true,
            clientCompany: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Limit to recent 100 quotes
    });

    return { data: quotes, error: null };
  } catch (error) {
    console.error("Error fetching MVP shared quotes for demo modal:", error);
    return { data: null, error: "Failed to fetch MVP quotes" };
  }
}

/**
 * Get MVP call maps for the build approval modal
 * Diagram JSON stays on the server, only the block counts are returned
 */
export async function getMVPCallMapsForApprovalModal() {
  try {
    const callMaps = await prisma.mVPCallMap.findMany({
      select: {
        id: true,
        name: true,
        updatedAt: true,
        flowData: true,
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 100,
    });

    const callMapsWithCounts = callMaps.map((callMap) => {
      const nodes =
        callMap.flowData &&
        typeof callMap.flowData === "object" &&
        Array.isArray((callMap.flowData as { nodes?: unknown }).nodes)
          ? ((callMap.flowData as { nodes: Array<{ type?: string }> }).nodes)
          : [];

      return {
        id: callMap.id,
        name: callMap.name,
        updatedAt: callMap.updatedAt,
        clientCompany: callMap.clientCompany,
        pageCount: nodes.filter((node) => node.type === "page").length,
        apiCount: nodes.filter((node) => node.type === "externalApi").length,
        customLogicCount: nodes.filter((node) => node.type === "customLogic").length,
      };
    });

    return { data: callMapsWithCounts, error: null };
  } catch (error) {
    console.error("Error fetching MVP call maps for approval modal:", error);
    return { data: null, error: "Failed to fetch MVP call maps" };
  }
}

/**
 * Get a meeting with full transcript by ID
 */
export async function getMeetingWithTranscript(id: string) {
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        startTime: true,
        formattedTranscript: true,
        summary: true,
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!meeting) {
      return { data: null, error: "Meeting not found" };
    }

    return { data: meeting, error: null };
  } catch (error) {
    console.error("Error fetching meeting with transcript:", error);
    return { data: null, error: "Failed to fetch meeting" };
  }
}

/**
 * Get an MVP shared quote with full details by ID
 */
export async function getMVPSharedQuoteWithDetails(id: string) {
  try {
    const quote = await prisma.mVPSharedQuote.findUnique({
      where: { id },
      select: {
        id: true,
        token: true,
        companyName: true,
        contactName: true,
        contactEmail: true,
        productSummary: true,
        diagramData: true,
        lineItems: true,
        milestones: true,
        subtotal: true,
        discountAmount: true,
        total: true,
        deposit: true,
        balance: true,
        expiresAt: true,
        createdAt: true,
        mvpCallMap: {
          select: {
            id: true,
            name: true,
            flowData: true,
            configuratorData: true,
            clientCompany: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!quote) {
      return { data: null, error: "MVP quote not found" };
    }

    return { data: quote, error: null };
  } catch (error) {
    console.error("Error fetching MVP shared quote with details:", error);
    return { data: null, error: "Failed to fetch MVP quote" };
  }
}

// ============================================
// PRESENTATION FETCHERS
// ============================================

export async function getPresentations() {
  try {
    const presentations = await prisma.presentation.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { data: presentations, error: null };
  } catch (error) {
    console.error("Error fetching presentations:", error);
    return { data: null, error: "Failed to fetch presentations" };
  }
}

export async function getPresentation(id: string) {
  try {
    const presentation = await prisma.presentation.findUnique({
      where: { id },
    });
    if (!presentation) {
      return { data: null, error: "Presentation not found" };
    }
    return { data: presentation, error: null };
  } catch (error) {
    console.error("Error fetching presentation:", error);
    return { data: null, error: "Failed to fetch presentation" };
  }
}

// ============================================
// GOVERNMENT CONTRACT FETCHERS
// ============================================

export async function getGovContracts() {
  try {
    const contracts = await prisma.govContract.findMany({
      include: {
        contacts: true,
        _count: {
          select: { activities: true, contacts: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return { data: contracts, error: null };
  } catch (error) {
    console.error("Error fetching government contracts:", error);
    return { data: null, error: "Failed to fetch government contracts" };
  }
}

export async function getGovContract(id: string) {
  try {
    const contract = await prisma.govContract.findUnique({
      where: { id },
      include: {
        contacts: {
          orderBy: { createdAt: "desc" },
        },
        activities: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!contract) {
      return { data: null, error: "Contract not found" };
    }
    return { data: contract, error: null };
  } catch (error) {
    console.error("Error fetching government contract:", error);
    return { data: null, error: "Failed to fetch government contract" };
  }
}

// ============================================
// GOVERNMENT MARKET RESEARCH
// ============================================

export async function getGovOpportunities(filters?: {
  naicsCode?: string;
  agency?: string;
  isActive?: boolean;
  isImported?: boolean;
  isDismissed?: boolean;
  search?: string;
}) {
  try {
    const where: Record<string, unknown> = {};

    if (filters?.naicsCode) where.naicsCode = filters.naicsCode;
    if (filters?.agency) where.agency = { contains: filters.agency, mode: "insensitive" };
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.isImported !== undefined) where.isImported = filters.isImported;
    if (filters?.isDismissed !== undefined) where.isDismissed = filters.isDismissed;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { agency: { contains: filters.search, mode: "insensitive" } },
        { solicitationNumber: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const opportunities = await prisma.govOpportunity.findMany({
      where,
      include: { analysis: true },
      orderBy: { postedDate: "desc" },
    });
    return { data: opportunities, error: null };
  } catch (error) {
    console.error("Error fetching gov opportunities:", error);
    return { data: null, error: "Failed to fetch government opportunities" };
  }
}

export async function getGovSpendingRecords(filters?: {
  fiscalYear?: number;
  naicsCode?: string;
  agencyName?: string;
}) {
  try {
    const conditions: string[] = [];
    if (filters?.fiscalYear) conditions.push(`sr."fiscalYear" = ${filters.fiscalYear}`);
    if (filters?.naicsCode) conditions.push(`sr."naicsCode" = '${filters.naicsCode}'`);
    if (filters?.agencyName) conditions.push(`sr."agencyName" ILIKE '%${filters.agencyName}%'`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const records = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        fiscalYear: number;
        agencyName: string;
        agencyCode: string | null;
        subAgencyName: string | null;
        naicsCode: string | null;
        naicsDescription: string | null;
        pscCode: string | null;
        totalObligated: number;
        contractCount: number;
        avgContractValue: number | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(`
      SELECT sr.id, sr."fiscalYear", sr."agencyName", sr."agencyCode", sr."subAgencyName",
             sr."naicsCode", sr."naicsDescription", sr."pscCode",
             sr."totalObligated"::float,
             COALESCE(ac."cnt", 0)::int as "contractCount",
             CASE WHEN COALESCE(ac."cnt", 0) > 0
                  THEN (sr."totalObligated" / ac."cnt")::float
                  ELSE NULL END as "avgContractValue",
             sr."createdAt", sr."updatedAt"
      FROM "GovSpendingRecord" sr
      LEFT JOIN (
        SELECT "awardingAgency", "naicsCode",
               CASE WHEN EXTRACT(MONTH FROM "startDate") >= 10
                    THEN EXTRACT(YEAR FROM "startDate")::int + 1
                    ELSE EXTRACT(YEAR FROM "startDate")::int END as fy,
               COUNT(*)::int as "cnt"
        FROM "GovAwardedContract"
        WHERE "startDate" IS NOT NULL
        GROUP BY "awardingAgency", "naicsCode", fy
      ) ac ON ac."awardingAgency" = sr."agencyName"
          AND (ac."naicsCode" = sr."naicsCode" OR (ac."naicsCode" IS NULL AND sr."naicsCode" IS NULL))
          AND ac.fy = sr."fiscalYear"
      ${whereClause}
      ORDER BY sr."fiscalYear" DESC, sr."totalObligated" DESC
    `);
    return { data: records, error: null };
  } catch (error) {
    console.error("Error fetching gov spending records:", error);
    return { data: null, error: "Failed to fetch spending records" };
  }
}

export async function getGovAwardedContracts(filters?: {
  naicsCode?: string;
  awardingAgency?: string;
  minAmount?: number;
  limit?: number;
}) {
  try {
    const where: Record<string, unknown> = {};

    if (filters?.naicsCode) where.naicsCode = filters.naicsCode;
    if (filters?.awardingAgency) {
      where.awardingAgency = { contains: filters.awardingAgency, mode: "insensitive" };
    }
    if (filters?.minAmount) where.awardAmount = { gte: filters.minAmount };

    const contracts = await prisma.govAwardedContract.findMany({
      where,
      orderBy: { awardAmount: "desc" },
      ...(filters?.limit ? { take: filters.limit } : {}),
    });

    return { data: contracts, error: null };
  } catch (error) {
    console.error("Error fetching gov awarded contracts:", error);
    return { data: null, error: "Failed to fetch awarded contracts" };
  }
}

export async function getCompetitorRankings(filters?: {
  naicsCode?: string;
  agencyName?: string;
  setAsideType?: string;
  limit?: number;
}) {
  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (filters?.naicsCode) {
      conditions.push(`"naicsCode" = $${paramIndex}`);
      params.push(filters.naicsCode);
      paramIndex++;
    }
    if (filters?.agencyName) {
      conditions.push(`"awardingAgency" ILIKE $${paramIndex}`);
      params.push(`%${filters.agencyName}%`);
      paramIndex++;
    }
    if (filters?.setAsideType) {
      conditions.push(`"setAsideType" ILIKE $${paramIndex}`);
      params.push(`%${filters.setAsideType}%`);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limitClause = filters?.limit ? `LIMIT ${filters.limit}` : "";

    const [rankings, samAwardees, setAsideTypes] = await Promise.all([
      prisma.$queryRawUnsafe<
        Array<{
          recipientName: string;
          recipientNameNormalized: string | null;
          totalWins: number;
          totalAwardValue: number;
          avgAwardValue: number;
          minAwardValue: number;
          maxAwardValue: number;
          topAgency: string;
          topSetAside: string | null;
          firstWinDate: Date | null;
          lastWinDate: Date | null;
        }>
      >(
        `SELECT 
          "recipientName",
          MAX("recipientNameNormalized") as "recipientNameNormalized",
          COUNT(*)::int as "totalWins",
          COALESCE(SUM("awardAmount"), 0)::float as "totalAwardValue",
          COALESCE(AVG("awardAmount"), 0)::float as "avgAwardValue",
          COALESCE(MIN("awardAmount"), 0)::float as "minAwardValue",
          COALESCE(MAX("awardAmount"), 0)::float as "maxAwardValue",
          (SELECT "awardingAgency" FROM "GovAwardedContract" g2 
           WHERE g2."recipientName" = "GovAwardedContract"."recipientName" 
           GROUP BY "awardingAgency" ORDER BY COUNT(*) DESC LIMIT 1) as "topAgency",
          (SELECT "setAsideType" FROM "GovAwardedContract" g3 
           WHERE g3."recipientName" = "GovAwardedContract"."recipientName" 
             AND g3."setAsideType" IS NOT NULL
           GROUP BY "setAsideType" ORDER BY COUNT(*) DESC LIMIT 1) as "topSetAside",
          MIN("startDate") as "firstWinDate",
          MAX("startDate") as "lastWinDate"
        FROM "GovAwardedContract"
        ${whereClause}
        GROUP BY "recipientName"
        HAVING COUNT(*) >= 1
        ORDER BY "totalAwardValue" DESC
        ${limitClause}`,
        ...params
      ),

      prisma.$queryRaw<
        Array<{
          awardeeName: string;
          awardeeNameNormalized: string | null;
          wins: number;
          totalValue: number;
        }>
      >`
        SELECT 
          "awardeeName",
          MAX("awardeeNameNormalized") as "awardeeNameNormalized",
          COUNT(*)::int as "wins",
          COALESCE(SUM("estimatedValue"), 0)::float as "totalValue"
        FROM "GovOpportunity"
        WHERE "awardeeName" IS NOT NULL AND "awardeeName" != ''
        GROUP BY "awardeeName"
        ORDER BY "totalValue" DESC
      `,

      prisma.$queryRaw<
        Array<{ setAsideType: string; count: number }>
      >`
        SELECT "setAsideType", COUNT(*)::int as "count"
        FROM "GovAwardedContract"
        WHERE "setAsideType" IS NOT NULL AND "setAsideType" != ''
        GROUP BY "setAsideType"
        ORDER BY "count" DESC
      `,
    ]);

    return { data: { rankings, samAwardees, setAsideTypes }, error: null };
  } catch (error) {
    console.error("Error fetching competitor rankings:", error);
    return { data: null, error: "Failed to fetch competitor rankings" };
  }
}

export async function getCompetitorProfile(recipientName: string) {
  try {
    const [contracts, samAwards, agencyBreakdown, naicsBreakdown, yearlyTrend, setAsideBreakdown] =
      await Promise.all([
        prisma.govAwardedContract.findMany({
          where: { recipientName },
          orderBy: { awardAmount: "desc" },
        }),

        prisma.govOpportunity.findMany({
          where: { awardeeName: recipientName },
          orderBy: { awardDate: "desc" },
        }),

        prisma.$queryRawUnsafe<
          Array<{
            awardingAgency: string;
            wins: number;
            totalValue: number;
            avgValue: number;
          }>
        >(
          `SELECT 
            "awardingAgency",
            COUNT(*)::int as "wins",
            COALESCE(SUM("awardAmount"), 0)::float as "totalValue",
            COALESCE(AVG("awardAmount"), 0)::float as "avgValue"
          FROM "GovAwardedContract"
          WHERE "recipientName" = $1
          GROUP BY "awardingAgency"
          ORDER BY "totalValue" DESC`,
          recipientName
        ),

        prisma.$queryRawUnsafe<
          Array<{
            naicsCode: string;
            naicsDescription: string | null;
            wins: number;
            totalValue: number;
          }>
        >(
          `SELECT 
            "naicsCode",
            MAX("naicsDescription") as "naicsDescription",
            COUNT(*)::int as "wins",
            COALESCE(SUM("awardAmount"), 0)::float as "totalValue"
          FROM "GovAwardedContract"
          WHERE "recipientName" = $1 AND "naicsCode" IS NOT NULL
          GROUP BY "naicsCode"
          ORDER BY "totalValue" DESC`,
          recipientName
        ),

        prisma.$queryRawUnsafe<
          Array<{
            year: number;
            wins: number;
            totalValue: number;
          }>
        >(
          `SELECT 
            EXTRACT(YEAR FROM "startDate")::int as "year",
            COUNT(*)::int as "wins",
            COALESCE(SUM("awardAmount"), 0)::float as "totalValue"
          FROM "GovAwardedContract"
          WHERE "recipientName" = $1 AND "startDate" IS NOT NULL
          GROUP BY EXTRACT(YEAR FROM "startDate")
          ORDER BY "year" ASC`,
          recipientName
        ),

        prisma.$queryRawUnsafe<
          Array<{
            setAsideType: string;
            wins: number;
            totalValue: number;
          }>
        >(
          `SELECT 
            "setAsideType",
            COUNT(*)::int as "wins",
            COALESCE(SUM("awardAmount"), 0)::float as "totalValue"
          FROM "GovAwardedContract"
          WHERE "recipientName" = $1 AND "setAsideType" IS NOT NULL AND "setAsideType" != ''
          GROUP BY "setAsideType"
          ORDER BY "totalValue" DESC`,
          recipientName
        ),
      ]);

    const totalValue = contracts.reduce((sum, c) => sum + c.awardAmount, 0);
    const avgValue = contracts.length > 0 ? totalValue / contracts.length : 0;

    return {
      data: {
        recipientName,
        totalWins: contracts.length,
        totalAwardValue: totalValue,
        avgAwardValue: avgValue,
        contracts,
        samAwards,
        agencyBreakdown,
        naicsBreakdown,
        yearlyTrend,
        setAsideBreakdown,
      },
      error: null,
    };
  } catch (error) {
    console.error("Error fetching competitor profile:", error);
    return { data: null, error: "Failed to fetch competitor profile" };
  }
}

export async function getMarketResearchSummary() {
  try {
    const [
      spendingByAgency,
      spendingByYear,
      spendingByNaics,
      awardedContractsCount,
      medianResult,
      lastSamSync,
      lastUsaSync,
    ] = await Promise.all([
      prisma.$queryRaw<
        Array<{ agencyName: string; totalSpent: number; totalContracts: number }>
      >`
        SELECT sr."agencyName",
               SUM(sr."totalObligated")::float as "totalSpent",
               COALESCE(ac."totalContracts", 0)::int as "totalContracts"
        FROM "GovSpendingRecord" sr
        LEFT JOIN (
          SELECT "awardingAgency", COUNT(*)::int as "totalContracts"
          FROM "GovAwardedContract"
          GROUP BY "awardingAgency"
        ) ac ON ac."awardingAgency" = sr."agencyName"
        GROUP BY sr."agencyName", ac."totalContracts"
        ORDER BY "totalSpent" DESC
      `,

      prisma.$queryRaw<
        Array<{ fiscalYear: number; totalSpent: number; totalContracts: number }>
      >`
        SELECT "fiscalYear", 
               SUM("totalObligated")::float as "totalSpent", 
               SUM("contractCount")::int as "totalContracts"
        FROM "GovSpendingRecord"
        GROUP BY "fiscalYear"
        ORDER BY "fiscalYear" ASC
      `,

      prisma.$queryRaw<
        Array<{ naicsCode: string; naicsDescription: string; totalSpent: number; totalContracts: number }>
      >`
        SELECT "naicsCode", 
               MAX("naicsDescription") as "naicsDescription",
               SUM("totalObligated")::float as "totalSpent", 
               SUM("contractCount")::int as "totalContracts"
        FROM "GovSpendingRecord"
        WHERE "naicsCode" IS NOT NULL
        GROUP BY "naicsCode"
        ORDER BY "totalSpent" DESC
      `,

      prisma.govAwardedContract.count(),

      prisma.$queryRaw<Array<{ median: number | null }>>`
        SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "awardAmount")::float as "median"
        FROM "GovAwardedContract"
      `,

      prisma.govSyncLog.findFirst({
        where: { source: "SAM_GOV", status: "SUCCESS" },
        orderBy: { completedAt: "desc" },
      }),

      prisma.govSyncLog.findFirst({
        where: { source: "USASPENDING", status: "SUCCESS" },
        orderBy: { completedAt: "desc" },
      }),
    ]);

    return {
      data: {
        spendingByAgency,
        spendingByYear,
        spendingByNaics,
        totalAwardedContracts: awardedContractsCount,
        medianContractSize: medianResult[0]?.median || 0,
        lastSamSync: lastSamSync?.completedAt || null,
        lastUsaSpendingSync: lastUsaSync?.completedAt || null,
      },
      error: null,
    };
  } catch (error) {
    console.error("Error fetching market research summary:", error);
    return { data: null, error: "Failed to fetch market research summary" };
  }
}