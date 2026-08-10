"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/actions";
import { reportOpsFailure } from "@/lib/ops-alerts";
import OpenAI from "openai";

interface ActionResult<T> {
  data: T | null;
  error: string | null;
}

async function getAdminUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

// ============================================================================
// Followup Templates
// ============================================================================

interface CreateFollowupTemplateData {
  name: string;
  prompt: string;
}

export async function createFollowupTemplate(
  data: CreateFollowupTemplateData
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    console.log("[Followup Templates] Creating template:", data.name);

    const template = await prisma.followupTemplate.create({
      data: {
        name: data.name,
        prompt: data.prompt,
      },
    });

    console.log("[Followup Templates] Template created:", template.id);
    revalidatePath("/dashboard/settings/followup-templates");
    return { data: { id: template.id }, error: null };
  } catch (error) {
    console.error("[Followup Templates] Error creating template:", error);
    return { data: null, error: "Failed to create template" };
  }
}

export async function updateFollowupTemplate(
  id: string,
  data: CreateFollowupTemplateData
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    console.log("[Followup Templates] Updating template:", id);

    const template = await prisma.followupTemplate.update({
      where: { id },
      data: {
        name: data.name,
        prompt: data.prompt,
      },
    });

    console.log("[Followup Templates] Template updated:", template.id);
    revalidatePath("/dashboard/settings/followup-templates");
    return { data: { id: template.id }, error: null };
  } catch (error) {
    console.error("[Followup Templates] Error updating template:", error);
    return { data: null, error: "Failed to update template" };
  }
}

export async function deleteFollowupTemplate(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    console.log("[Followup Templates] Deleting template:", id);

    await prisma.followupTemplate.delete({
      where: { id },
    });

    console.log("[Followup Templates] Template deleted:", id);
    revalidatePath("/dashboard/settings/followup-templates");
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Followup Templates] Error deleting template:", error);
    return { data: null, error: "Failed to delete template" };
  }
}

// ============================================================================
// Meeting Followup Generation
// ============================================================================

export async function generateFollowup(
  meetingId: string,
  templateId: string
): Promise<ActionResult<{ id: string; content: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    console.log("[Followup] Generating followup for meeting:", meetingId, "with template:", templateId);

    console.log("[Followup] Fetching meeting and template from database...");
    const [meeting, template] = await Promise.all([
      prisma.meeting.findUnique({
        where: { id: meetingId },
        include: { clientCompany: { select: { name: true } } },
      }),
      prisma.followupTemplate.findUnique({
        where: { id: templateId },
      }),
    ]);

    if (!meeting) return { data: null, error: "Meeting not found" };
    if (!template) return { data: null, error: "Template not found" };
    if (!meeting.formattedTranscript) {
      return { data: null, error: "Meeting has no transcript" };
    }

    console.log("[Followup] Meeting found:", meeting.title);
    console.log("[Followup] Template found:", template.name);
    console.log("[Followup] Transcript length:", meeting.formattedTranscript.length, "chars");

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return { data: null, error: "OpenAI API key not configured" };
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const systemPrompt = `You are an assistant for Jaro.dev, a software development agency that builds MVPs for startups and companies.

Your task is to generate content based on a meeting transcript and the following instructions:

${template.prompt}

Generate the content directly without any preamble, meta-commentary, or explanation. Just output the final content ready to use.`;

    const userPrompt = `Meeting: "${meeting.title}"
${meeting.clientCompany ? `Client: ${meeting.clientCompany.name}` : ""}
Participants: ${meeting.participants.join(", ")}
Date: ${meeting.startTime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

Transcript:
${meeting.formattedTranscript}`;

    console.log("[Followup] Sending request to OpenAI (model: gpt-5-mini)...");
    const startTime = Date.now();

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Followup] OpenAI response received in ${elapsed}ms`);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { data: null, error: "Empty response from AI" };
    }

    console.log("[Followup] Generated content length:", content.length, "chars");
    console.log("[Followup] Saving followup to database...");

    const followup = await prisma.meetingFollowup.create({
      data: {
        content,
        status: "DRAFT",
        meetingId: meeting.id,
        templateId: template.id,
      },
    });

    console.log("[Followup] Followup saved:", followup.id);
    revalidatePath("/dashboard/calls");
    return { data: { id: followup.id, content: followup.content }, error: null };
  } catch (error) {
    console.error("[Followup] Error generating followup:", error);
    return { data: null, error: "Failed to generate followup" };
  }
}

export async function updateFollowupContent(
  id: string,
  content: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    console.log("[Followup] Updating followup content:", id);

    await prisma.meetingFollowup.update({
      where: { id },
      data: { content },
    });

    console.log("[Followup] Followup content updated:", id);
    revalidatePath("/dashboard/calls");
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Followup] Error updating followup:", error);
    return { data: null, error: "Failed to update followup" };
  }
}

export async function sendFollowup(
  id: string,
  recipientEmail: string,
  subject: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    console.log("[Followup] Sending followup:", id, "to:", recipientEmail);

    const followup = await prisma.meetingFollowup.findUnique({
      where: { id },
    });

    if (!followup) return { data: null, error: "Followup not found" };

    console.log("[Followup] Sending email via Gmail API...");

    const htmlBody = followup.content
      .split("\n")
      .map((line) => (line.trim() === "" ? "<br>" : `<p>${line}</p>`))
      .join("");

    // Send from the sender's own mailbox when they have one, so replies reach them
    const senderMailbox = user.sendingMailbox ?? undefined;
    const senderName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

    const sent = await sendEmail(recipientEmail, subject, htmlBody, {
      from: senderMailbox,
      fromName: senderName,
    });

    if (sent.error) {
      await reportOpsFailure({
        source: "Meeting follow-ups",
        summary: "Follow-up email could not be sent",
        error: sent.error,
        context: {
          followupId: id,
          recipient: recipientEmail,
          mailbox: senderMailbox ?? "default",
        },
        url: "/dashboard/calls",
      });
      return { data: null, error: `Failed to send email: ${sent.error}` };
    }

    console.log("[Followup] Email sent, updating status to SENT...");

    await prisma.meetingFollowup.update({
      where: { id },
      data: {
        status: "SENT",
        sentTo: recipientEmail,
        sentAt: new Date(),
      },
    });

    console.log("[Followup] Followup marked as SENT:", id);
    revalidatePath("/dashboard/calls");
    return { data: { id }, error: null };
  } catch (error) {
    await reportOpsFailure({
      source: "Meeting follow-ups",
      summary: "Sending a follow-up failed unexpectedly",
      error,
      context: { followupId: id, recipient: recipientEmail },
      url: "/dashboard/calls",
    });
    return { data: null, error: "Failed to send followup" };
  }
}

export async function deleteFollowup(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    console.log("[Followup] Deleting followup:", id);

    await prisma.meetingFollowup.delete({
      where: { id },
    });

    console.log("[Followup] Followup deleted:", id);
    revalidatePath("/dashboard/calls");
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Followup] Error deleting followup:", error);
    return { data: null, error: "Failed to delete followup" };
  }
}
