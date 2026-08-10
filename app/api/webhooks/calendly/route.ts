import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { advanceCompanyDeal } from "@/lib/crm/pipeline";
import { upsertPersonByEmail } from "@/lib/crm/people";
import { logScheduledMeetings, syncMeetingRsvps } from "@/lib/crm/meeting-activity";
import { reportOpsFailure } from "@/lib/ops-alerts";
import { withWebhookAlerts } from "@/lib/webhooks/route-handler";

// Discovery call scheduling URL to filter for
const DISCOVERY_CALL_SCHEDULING_URL = "https://calendly.com/jaro-dev/discovery";

// Generic email domains that should not be used to create companies
const GENERIC_EMAIL_DOMAINS = [
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "live.com",
  "msn.com",
  "aol.com",
  "protonmail.com",
  "mail.com",
];

// Calendly webhook payload types
interface CalendlyWebhookPayload {
  event: string;
  payload: {
    email: string;
    name: string;
    event: string; // Event URI (e.g., https://api.calendly.com/scheduled_events/xxx)
    event_type: {
      uuid: string;
      slug: string;
      scheduling_url: string;
    };
    // Present on Calendly v2 invitee.created payloads
    scheduled_event?: {
      name?: string;
      start_time?: string;
      location?: { join_url?: string };
    };
    questions_and_answers: Array<{
      question: string;
      answer: string;
      position: number;
    }>;
  };
}

/**
 * Extract domain from email address
 */
function extractDomainFromEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) {
    return "";
  }
  return parts[1].toLowerCase();
}

/**
 * Extract a readable company name from a domain
 */
function extractCompanyNameFromDomain(domain: string): string {
  const parts = domain.split(".");
  if (parts.length > 0) {
    const name = parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return domain;
}

/**
 * Find or create a company by email domain and update status to CALL_BOOKED
 */
async function findOrCreateCompanyAndUpdateStatus(
  email: string,
  callBookingDetails: string | null
): Promise<{ companyId: string | null; isNew: boolean }> {
  const domain = extractDomainFromEmail(email);

  // Skip generic email domains
  if (!domain || GENERIC_EMAIL_DOMAINS.includes(domain)) {
    console.log(`[Calendly Webhook] Skipping company creation for generic domain: ${domain}`);
    return { companyId: null, isNew: false };
  }

  try {
    // Check if company already exists by domain (stored in website field)
    let company = await prisma.company.findFirst({
      where: {
        website: {
          equals: domain,
          mode: "insensitive",
        },
      },
    });

    let isNew = false;

    if (!company) {
      const companyName = extractCompanyNameFromDomain(domain);
      company = await prisma.company.create({
        data: {
          name: companyName,
          website: domain,
          callBookingDetails,
        },
      });
      isNew = true;
      console.log(`[Calendly Webhook] Created new company: ${companyName} (${company.id})`);
    } else {
      await prisma.company.update({
        where: { id: company.id },
        data: { callBookingDetails },
      });
      console.log(`[Calendly Webhook] Stored call booking details on ${company.name} (${company.id})`);
    }

    console.log(`[Calendly Webhook] Advancing deal to Booked Call for ${company.name}...`);
    await advanceCompanyDeal(company.id, "Booked Call");

    // Link any unlinked form submissions with matching email domain
    const matchingSubmissions = await prisma.embedFormSubmission.updateMany({
      where: {
        email: {
          endsWith: `@${domain}`,
          mode: "insensitive",
        },
        companyId: null,
      },
      data: { companyId: company.id },
    });

    if (matchingSubmissions.count > 0) {
      console.log(`[Calendly Webhook] Linked ${matchingSubmissions.count} form submissions to company ${company.name}`);
    }

    return { companyId: company.id, isNew };
  } catch (error) {
    // Swallowed so the booking is still recorded against the person, but the
    // deal will not have advanced to Booked Call without someone stepping in.
    await reportOpsFailure({
      source: "Webhook: calendly",
      summary: "Could not attach the booking to a company or advance its deal",
      error,
      context: { email, domain },
      url: "/dashboard/crm/deals",
    });
    return { companyId: null, isNew: false };
  }
}

/**
 * Creates or updates the CRM contact for the invitee and puts the booking on
 * their timeline. The calendar sync writes the same entry once the event lands
 * on a team calendar, but only for calendars it watches and up to ten minutes
 * later, so the booking is recorded here as well. Both writes share an external
 * id keyed on contact and start time, so only one entry survives.
 */
async function recordInviteeBooking(
  payload: CalendlyWebhookPayload["payload"],
  companyId: string | null
): Promise<string | null> {
  console.log(`[Calendly Webhook] Upserting contact for ${payload.email}...`);

  const person = await upsertPersonByEmail({
    email: payload.email,
    fullName: payload.name || null,
    source: "calendly:discovery",
    companyId,
  });

  if (!person.data) {
    await reportOpsFailure({
      source: "Webhook: calendly",
      summary: "Contact upsert failed; a booked discovery call is missing from the CRM",
      error: person.error,
      context: { email: payload.email, name: payload.name },
      url: "/dashboard/crm/people",
    });
    return null;
  }

  const startTime = payload.scheduled_event?.start_time
    ? new Date(payload.scheduled_event.start_time)
    : null;

  if (!startTime || Number.isNaN(startTime.getTime())) {
    console.log(
      "[Calendly Webhook] No start time on the payload; the calendar sync will log the booking"
    );
    return person.data.id;
  }

  console.log("[Calendly Webhook] Logging the booking on the contact timeline...");
  const booking = {
    attendeeEmails: [payload.email],
    startTime,
    title: payload.scheduled_event?.name || "Discovery call",
    meetingUrl: payload.scheduled_event?.location?.join_url ?? null,
    source: "calendly",
    defaultLeadResponseStatus: "accepted" as const,
  };
  await logScheduledMeetings([booking]);
  // Booking via Calendly is an explicit accept — mirror that as a timeline event.
  await syncMeetingRsvps([booking]);

  return person.data.id;
}

export const POST = withWebhookAlerts("calendly", async (request) => {
  let inviteeEmail: string | null = null;

  try {
    const payload: CalendlyWebhookPayload = await request.json();
    inviteeEmail = payload.payload?.email ?? null;

    console.log("[Calendly Webhook] ========== WEBHOOK RECEIVED ==========");
    console.log("[Calendly Webhook] Full payload:", JSON.stringify(payload, null, 2));
    console.log("[Calendly Webhook] Event type:", payload.event);

    // Only process invitee.created events
    if (payload.event !== "invitee.created") {
      console.log(`[Calendly Webhook] Ignoring event type: ${payload.event}`);
      console.log("[Calendly Webhook] ========== WEBHOOK IGNORED ==========");
      return NextResponse.json({
        data: { received: true, processed: false, reason: "not invitee.created event" },
        error: null,
      });
    }

    // Check if this is a discovery call by checking the scheduling URL
    const schedulingUrl = payload.payload.event_type?.scheduling_url;
    console.log(`[Calendly Webhook] Scheduling URL: ${schedulingUrl}`);
    console.log(`[Calendly Webhook] Expected URL: ${DISCOVERY_CALL_SCHEDULING_URL}`);
    
    if (!schedulingUrl || schedulingUrl !== DISCOVERY_CALL_SCHEDULING_URL) {
      console.log("[Calendly Webhook] Ignoring non-discovery call");
      console.log("[Calendly Webhook] ========== WEBHOOK IGNORED ==========");
      return NextResponse.json({
        data: { received: true, processed: false, reason: "not discovery call" },
        error: null,
      });
    }

    console.log("[Calendly Webhook] Processing discovery call booking");
    console.log(`[Calendly Webhook] Invitee email: ${payload.payload.email}`);
    console.log(`[Calendly Webhook] Invitee name: ${payload.payload.name}`);

    // Extract Q1 answer (first question based on position)
    const questionsAndAnswers = payload.payload.questions_and_answers || [];
    console.log(`[Calendly Webhook] Questions and answers (${questionsAndAnswers.length} total):`);
    questionsAndAnswers.forEach((qa, idx) => {
      console.log(`[Calendly Webhook]   [${idx}] Position ${qa.position}: "${qa.question}" -> "${qa.answer}"`);
    });
    
    const q1 = questionsAndAnswers.find((qa) => qa.position === 0) || questionsAndAnswers[0];
    const callBookingDetails = q1?.answer || null;

    if (callBookingDetails) {
      console.log(`[Calendly Webhook] Selected Q1 answer: ${callBookingDetails.substring(0, 200)}${callBookingDetails.length > 200 ? "..." : ""}`);
    } else {
      console.log("[Calendly Webhook] No Q1 answer found");
    }

    // Find or create company and update status to CALL_BOOKED
    const { companyId, isNew } = await findOrCreateCompanyAndUpdateStatus(
      payload.payload.email,
      callBookingDetails
    );

    const personId = await recordInviteeBooking(payload.payload, companyId);

    console.log("[Calendly Webhook] Processing complete");
    console.log(`[Calendly Webhook]   Company ID: ${companyId}`);
    console.log(`[Calendly Webhook]   Person ID: ${personId}`);
    console.log(`[Calendly Webhook]   Is new company: ${isNew}`);
    console.log("[Calendly Webhook] ========== WEBHOOK SUCCESS ==========");

    return NextResponse.json({
      data: {
        received: true,
        processed: true,
        companyId,
        personId,
        isNew,
      },
      error: null,
    });
  } catch (error) {
    console.error("[Calendly Webhook] ========== WEBHOOK ERROR ==========");
    console.error("[Calendly Webhook] Error stack:", error instanceof Error ? error.stack : "No stack trace");

    await reportOpsFailure({
      source: "Webhook: calendly",
      summary: "Failed to process a Calendly booking",
      error,
      context: { invitee: inviteeEmail },
      url: "/dashboard/submissions",
    });

    return NextResponse.json(
      {
        data: null,
        error: `Webhook processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
});
