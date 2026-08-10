"use server";

import prisma from "@/lib/prisma";

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

function extractDomainFromEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return "";
  return parts[1].toLowerCase();
}

export interface CreateOrResumeSessionResult {
  data: {
    id: string;
    email: string;
    name: string | null;
    flowData: unknown;
    chatHistory: unknown;
    quoteTotal: number | null;
  } | null;
  error: string | null;
}

export async function createOrResumeSession(
  email: string,
  name?: string
): Promise<CreateOrResumeSessionResult> {
  try {
    console.log(`[MvpPlanner] Creating or resuming session for ${email}`);

    // Try to find an existing session for this email
    const existingSession = await prisma.mvpPlannerSession.findFirst({
      where: { email: email.toLowerCase() },
      orderBy: { updatedAt: "desc" },
    });

    if (existingSession) {
      console.log(
        `[MvpPlanner] Found existing session ${existingSession.id} for ${email}`
      );
      return {
        data: {
          id: existingSession.id,
          email: existingSession.email,
          name: existingSession.name,
          flowData: existingSession.flowData,
          chatHistory: existingSession.chatHistory,
          quoteTotal: existingSession.quoteTotal,
        },
        error: null,
      };
    }

    // Find company by email domain
    const domain = extractDomainFromEmail(email);
    let companyId: string | null = null;

    if (domain && !GENERIC_EMAIL_DOMAINS.includes(domain)) {
      const company = await prisma.company.findFirst({
        where: { website: { equals: domain, mode: "insensitive" } },
      });
      if (company) {
        companyId = company.id;
        console.log(
          `[MvpPlanner] Linked session to company ${company.name} (${company.id})`
        );
      }
    }

    // Create new session
    const session = await prisma.mvpPlannerSession.create({
      data: {
        email: email.toLowerCase(),
        name: name || null,
        companyId,
      },
    });

    console.log(`[MvpPlanner] Created new session ${session.id} for ${email}`);

    return {
      data: {
        id: session.id,
        email: session.email,
        name: session.name,
        flowData: session.flowData,
        chatHistory: session.chatHistory,
        quoteTotal: session.quoteTotal,
      },
      error: null,
    };
  } catch (error) {
    console.error("[MvpPlanner] Error creating/resuming session:", error);
    return { data: null, error: "Failed to initialize session" };
  }
}

export interface SaveSessionResult {
  data: { success: boolean } | null;
  error: string | null;
}

export async function saveSession(
  sessionId: string,
  flowData: unknown,
  chatHistory: unknown,
  quoteTotal: number | null
): Promise<SaveSessionResult> {
  try {
    await prisma.mvpPlannerSession.update({
      where: { id: sessionId },
      data: {
        flowData: flowData !== null ? JSON.parse(JSON.stringify(flowData)) : undefined,
        chatHistory: chatHistory !== null ? JSON.parse(JSON.stringify(chatHistory)) : undefined,
        quoteTotal,
      },
    });

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("[MvpPlanner] Error saving session:", error);
    return { data: null, error: "Failed to save session" };
  }
}
