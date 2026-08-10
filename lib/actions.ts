"use server";

import { revalidatePath } from "next/cache";
import { Prisma, UserRole, SlackNotificationEventType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createId } from "@paralleldrive/cuid2";
import prisma from "@/lib/prisma";
import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { del } from "@vercel/blob";
import {
  notifyActionItemCreated,
  notifyTaskCompleted,
  notifyActionItemCompleted,
  notifyTaskUnblocked,
  notifyFeatureRequested,
  notifyBugRequested,
  checkAndNotifyUnblockedTasks,
  sendNotification,
} from "@/lib/slack-notifications";
import { JARO_DEV_INTERNAL_CLIENT_ID, isJaroDevTeamEmail } from "@/lib/constants";
import { filterDuplicateSteps } from "@/lib/task-dedup";
import { sendEmail as sendGmailMessage } from "@/lib/integrations/gmail";
import { buildMVPCallMapContext } from "@/lib/mvp/call-map-context";

/**
 * Sends a one-off transactional email from a delegated @jaro.dev mailbox.
 * Sequence sends go through lib/actions/sequences.ts instead, which also records
 * the message and threads follow-ups.
 */
export async function sendEmail(
  to: string,
  title: string,
  body: string,
  options?: { from?: string; fromName?: string; replyTo?: string }
): Promise<{ data: { gmailMessageId: string } | null; error: string | null }> {
  const result = await sendGmailMessage({
    to,
    subject: title,
    html: body,
    from: options?.from,
    fromName: options?.fromName,
    replyTo: options?.replyTo,
  });

  if (!result.data) {
    return { data: null, error: result.error };
  }

  return {
    data: { gmailMessageId: result.data.gmailMessageId },
    error: null,
  };
}

export async function revalidatePathClient(path: string) {
  revalidatePath(path, "layout");
}

export async function createPrototype(data: { name: string; description?: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  const prototype = await prisma.prototype.create({
    data: {
      name: data.name,
      description: data.description,
      userId: user!.id,
      flowData: { nodes: [], edges: [] }
    }
  });

  return prototype;
}

export async function updatePrototype(id: string, flowData: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated");

  const prototype = await prisma.prototype.update({
    where: { id },
    data: { flowData }
  });

  return prototype;
}

export async function createRole(prototypeId: string, data: { name: string; description?: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated");

  const role = await prisma.role.create({
    data: {
      name: data.name,
      description: data.description,
      prototypeId
    }
  });

  return role;
}

export async function updateRole(id: string, data: { name: string; description?: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated");

  const role = await prisma.role.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description
    }
  });

  return role;
}

export async function deleteRole(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated");

  await prisma.role.delete({
    where: { id }
  });
}

export async function createFunnel(data: { name: string; description?: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  const funnel = await prisma.funnel.create({
    data: {
      name: data.name,
      description: data.description,
      userId: user!.id,
      flowData: {"sections":[{"id":"1","name":"Ad Views","value":38461,"percentage":100},{"id":"2","name":"Link clicks","value":999,"percentage":2.597436364109098},{"id":"3","name":"Form submissions","value":18,"percentage":1.801801801801802},{"id":"1737204065386","name":"Calls booked","value":8,"percentage":44.44444444444444},{"id":"1737204091594","name":"Proposals sent","value":5,"percentage":62.5},{"id":"1737204230437","name":"Proposals converted","value":0,"percentage":0}]}
    }
  });

  return funnel;
}

export async function updateFunnel(id: string, data: { name?: string; description?: string; sections?: any }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated");

  const funnel = await prisma.funnel.update({
    where: { id },
    data: { 
      ...(data.name && { name: data.name }),
      ...(data.description && { description: data.description }),
      ...(data.sections && { flowData: { sections: data.sections } })
    }
  });

  return funnel;
}

export async function updateCalculation(
  id: string,
  data: { name: string; description?: string; flowData?: any }
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  return prisma.calculation.update({
    where: { id },
    data,
  });
}

export async function deleteCalculation(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  return prisma.calculation.delete({
    where: { id },
  });
}

export async function cloneCalculation(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const originalCalculation = await prisma.calculation.findUnique({
    where: { id },
  });

  if (!originalCalculation) throw new Error("Calculation not found");

  return prisma.calculation.create({
    data: {
      name: `(Copy) ${originalCalculation.name}`,
      description: originalCalculation.description,
      flowData: originalCalculation.flowData as any,
      userId: originalCalculation.userId,
    },
  });
}

// Slack channel verification
export async function verifySlackChannel(channelId: string): Promise<{
  data: { valid: boolean; channelName?: string } | null;
  error: string | null;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can verify Slack channels" };
    }

    const slackToken = process.env.SLACK_BOT_TOKEN;
    if (!slackToken) {
      return { data: null, error: "Slack integration not configured" };
    }

    // Validate channel ID format (should start with C, D, or G and be alphanumeric)
    if (!/^[CDG][A-Z0-9]+$/i.test(channelId)) {
      return { data: { valid: false }, error: "Invalid channel ID format. Channel IDs typically start with C, D, or G followed by alphanumeric characters." };
    }

    // Call Slack API to get channel info
    const response = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${slackToken}`,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!result.ok) {
      if (result.error === "channel_not_found") {
        return { data: { valid: false }, error: "Channel not found. Make sure the channel ID is correct." };
      }
      if (result.error === "not_in_channel") {
        return { data: { valid: false }, error: "Bot is not a member of this channel. Please invite the bot to the channel first." };
      }
      return { data: { valid: false }, error: `Slack API error: ${result.error}` };
    }

    return {
      data: {
        valid: true,
        channelName: result.channel?.name,
      },
      error: null,
    };
  } catch (error) {
    console.error("Error verifying Slack channel:", error);
    return { data: null, error: "Failed to verify Slack channel" };
  }
}

// Client Company actions
export async function createClientCompany(data: { name: string }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can create client companies" };
    }

    const clientCompany = await prisma.company.create({
      data: {
        name: data.name,
      },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    revalidatePath("/dashboard/clients");
    return { data: clientCompany, error: null };
  } catch (error) {
    console.error("Error creating client company:", error);
    return { data: null, error: "Failed to create client company" };
  }
}

// Status is derived from the company's deals and cannot be set here. Move the
// deal instead, via updateDealStage.
export async function updateClientCompany(
  id: string,
  data: {
    name?: string;
    slackPublicChannelId?: string | null;
    slackInternalChannelId?: string | null;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can update client companies" };
    }

    const clientCompany = await prisma.company.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slackPublicChannelId !== undefined && {
          slackPublicChannelId: data.slackPublicChannelId || null,
        }),
        ...(data.slackInternalChannelId !== undefined && {
          slackInternalChannelId: data.slackInternalChannelId || null,
        }),
      },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${id}`);
    return { data: clientCompany, error: null };
  } catch (error) {
    console.error("Error updating client company:", error);
    return { data: null, error: "Failed to update client company" };
  }
}

export async function deleteClientCompany(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can delete client companies" };
    }

    // Prevent deleting protected client
    if (id === JARO_DEV_INTERNAL_CLIENT_ID) {
      return { data: null, error: "This client company cannot be deleted" };
    }

    // Check if there are users linked to this client company
    const usersCount = await prisma.user.count({
      where: { clientCompanyId: id },
    });

    if (usersCount > 0) {
      return { data: null, error: "Cannot delete client company with linked users. Remove users first." };
    }

    await prisma.company.delete({
      where: { id },
    });

    revalidatePath("/dashboard/clients");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting client company:", error);
    return { data: null, error: "Failed to delete client company" };
  }
}

// Case Study actions
export async function createCaseStudy(data: {
  name: string;
  companyName?: string;
  body: string;
  technologies: string[];
  services: string[];
  publicUrl?: string;
  clientCompanyId?: string;
}) {
  try {
    const caseStudy = await prisma.caseStudy.create({
      data: {
        name: data.name,
        companyName: data.companyName,
        body: data.body,
        technologies: data.technologies as any[],
        services: data.services as any[],
        publicUrl: data.publicUrl,
        clientCompanyId: data.clientCompanyId,
      },
    });

    revalidatePath("/dashboard/case-studies");
    return { data: caseStudy, error: null };
  } catch (error) {
    console.error("Error creating case study:", error);
    return { data: null, error: "Failed to create case study" };
  }
}

export async function updateCaseStudy(id: string, data: {
  name?: string;
  companyName?: string;
  body?: string;
  technologies?: string[];
  services?: string[];
  publicUrl?: string;
  clientCompanyId?: string | null;
}) {
  try {
    const caseStudy = await prisma.caseStudy.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data.technologies !== undefined && { technologies: data.technologies as any[] }),
        ...(data.services !== undefined && { services: data.services as any[] }),
        ...(data.publicUrl !== undefined && { publicUrl: data.publicUrl }),
        ...(data.clientCompanyId !== undefined && { clientCompanyId: data.clientCompanyId }),
      },
    });

    revalidatePath("/dashboard/case-studies");
    revalidatePath(`/dashboard/case-studies/${id}`);
    return { data: caseStudy, error: null };
  } catch (error) {
    console.error("Error updating case study:", error);
    return { data: null, error: "Failed to update case study" };
  }
}

export async function deleteCaseStudy(id: string) {
  try {
    await prisma.caseStudy.delete({
      where: { id },
    });

    revalidatePath("/dashboard/case-studies");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting case study:", error);
    return { data: null, error: "Failed to delete case study" };
  }
}

// Offer actions
export async function createOffer(data: {
  title: string;
  description?: string;
}) {
  try {
    const offer = await prisma.offer.create({
      data: {
        title: data.title,
        description: data.description,
      },
    });

    revalidatePath("/dashboard/offers");
    return { data: offer, error: null };
  } catch (error) {
    console.error("Error creating offer:", error);
    return { data: null, error: "Failed to create offer" };
  }
}

export async function updateOffer(
  id: string,
  data: {
    title?: string;
    description?: string;
  }
) {
  try {
    const offer = await prisma.offer.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
      },
    });

    revalidatePath("/dashboard/offers");
    return { data: offer, error: null };
  } catch (error) {
    console.error("Error updating offer:", error);
    return { data: null, error: "Failed to update offer" };
  }
}

export async function deleteOffer(id: string) {
  try {
    await prisma.offer.delete({
      where: { id },
    });

    revalidatePath("/dashboard/offers");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting offer:", error);
    return { data: null, error: "Failed to delete offer" };
  }
}

// ============================================
// DEMO GENERATION FROM SALES CALLS
// ============================================

import OpenAI from "openai";
import {
  scrapeBrandFromDomain,
  extractDomainFromEmail,
  type BrandInfo,
} from "@/lib/scraping/brand";

export interface ProductRequirements {
  appType: string;
  appDescription: string;
  targetUsers: string;
  keyFeatures: Array<{ name: string; description: string }>;
  uiPreferences: string[];
}

/**
 * Extract product requirements from a meeting transcript using AI
 */
export async function extractProductRequirements(
  transcript: string
): Promise<{ data: ProductRequirements | null; error: string | null }> {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.warn("[extractProductRequirements] OPENAI_API_KEY not configured");
      return { data: null, error: "OpenAI API key not configured" };
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const systemPrompt = `You are a product analyst for Jaro.dev, a software development agency that builds MVPs for startups and companies.

Your task is to analyze a sales call transcript and extract the product requirements that the potential customer discussed.

Extract the following information:
1. appType: What type of application they want (e.g., "Web Application", "Mobile App", "Dashboard", "SaaS Platform", "Internal Tool", "E-commerce Site", etc.)
2. appDescription: A concise description of what the application should do (2-3 sentences)
3. targetUsers: Who will use this application (e.g., "Small business owners", "Healthcare professionals", "End consumers", etc.)
4. keyFeatures: An array of the main features/screens they want, each with a name and description
5. uiPreferences: Any UI/UX preferences they mentioned (e.g., "Clean and minimal", "Dark mode", "Mobile-first", etc.)

If certain information is not clearly mentioned, make reasonable inferences based on the context.
Focus on features that can be visually demonstrated in a UI prototype.

Return your response as JSON with this exact structure:
{
  "appType": "string",
  "appDescription": "string", 
  "targetUsers": "string",
  "keyFeatures": [{"name": "string", "description": "string"}],
  "uiPreferences": ["string"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyze this sales call transcript and extract the product requirements:\n\n${transcript.substring(0, 15000)}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { data: null, error: "Empty response from OpenAI" };
    }

    const requirements = JSON.parse(content) as ProductRequirements;

    // Ensure keyFeatures is an array
    if (!Array.isArray(requirements.keyFeatures)) {
      requirements.keyFeatures = [];
    }

    // Ensure uiPreferences is an array
    if (!Array.isArray(requirements.uiPreferences)) {
      requirements.uiPreferences = [];
    }

    console.log("[extractProductRequirements] Extracted:", requirements);

    return { data: requirements, error: null };
  } catch (error) {
    console.error("[extractProductRequirements] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to extract requirements",
    };
  }
}

/**
 * Extract system requirements from a transcript as a flat list of strings.
 * Used to condense a long transcript into structured requirements before
 * passing them to a Cursor agent prompt.
 */
async function extractSystemRequirementsFromTranscript(
  transcript: string
): Promise<{ data: string[] | null; error: string | null }> {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.warn("[extractSystemRequirements] OPENAI_API_KEY not configured");
      return { data: null, error: "OpenAI API key not configured" };
    }

    const client = new OpenAI({ apiKey: openaiApiKey });

    console.log("[extractSystemRequirements] Extracting requirements from transcript...");

    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are a senior product analyst at a software development agency. Your job is to read a meeting/sales call transcript and extract every system requirement, feature request, technical constraint, integration need, and user expectation mentioned.

Return a JSON object with a single key "requirements" whose value is an array of strings. Each string should be a clear, self-contained requirement statement.

Rules:
- Be exhaustive - capture every requirement, no matter how small
- Each requirement should be a single, actionable statement
- Include functional requirements (features, pages, flows)
- Include non-functional requirements (performance, security, branding)
- Include integration requirements (third-party APIs, services)
- Include user-role and permission requirements
- Include UI/UX preferences and constraints
- Do NOT include internal agency discussion points or pricing details
- Do NOT duplicate requirements - merge similar ones into a single clear statement

Example output:
{"requirements": ["Users must be able to sign up with email and Google OAuth", "Dashboard should show real-time analytics with charts", "Admin users can manage all user accounts", "Must integrate with Stripe for payment processing"]}`,
        },
        {
          role: "user",
          content: `Extract all system requirements from this transcript:\n\n${transcript}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { data: null, error: "Empty response from OpenAI" };
    }

    const parsed = JSON.parse(content) as { requirements: string[] };

    if (!Array.isArray(parsed.requirements)) {
      return { data: null, error: "Invalid response format - missing requirements array" };
    }

    console.log("[extractSystemRequirements] Extracted", parsed.requirements.length, "requirements");

    return { data: parsed.requirements, error: null };
  } catch (error) {
    console.error("[extractSystemRequirements] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to extract system requirements",
    };
  }
}

// ============================================
// DEMO GENERATION PIPELINE - GitHub/Cursor/Vercel
// ============================================

const GITHUB_ORG = process.env.GITHUB_ORG || "Jaro-dev-studio";
const GITHUB_TEMPLATE_REPO = process.env.GITHUB_TEMPLATE_REPO || "demo-template";

/**
 * Sanitize a company name to a valid GitHub repo name (with -internal suffix for demos)
 */
function sanitizeRepoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50) + "-internal";
}

/**
 * Sanitize a project name to a valid GitHub repo name (no suffix)
 */
function sanitizeProjectRepoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}

/**
 * Generate a URL-friendly slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

/**
 * Generate a slug that is not already taken, appending a counter when needed
 */
async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 2;

  while (await prisma.demo.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Check if a GitHub repository exists
 */
async function checkGitHubRepoExists(
  repoName: string
): Promise<{ exists: boolean; repoUrl: string | null }> {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return { exists: false, repoUrl: null };
    }

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_ORG}/${repoName}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return { exists: true, repoUrl: data.html_url };
    }

    return { exists: false, repoUrl: null };
  } catch {
    return { exists: false, repoUrl: null };
  }
}

/**
 * Get the default branch of a GitHub repository (main or master)
 * @param repoUrl - Full GitHub repo URL (e.g., https://github.com/owner/repo)
 */
async function getRepoDefaultBranch(repoUrl: string): Promise<string> {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.log("[getRepoDefaultBranch] No GITHUB_TOKEN, defaulting to 'main'");
      return "main";
    }

    // Extract owner/repo from URL
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      console.log("[getRepoDefaultBranch] Could not parse repo URL, defaulting to 'main'");
      return "main";
    }

    const owner = match[1];
    const repo = match[2].replace(/\.git$/, "");

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const defaultBranch = data.default_branch || "main";
      console.log(`[getRepoDefaultBranch] ${owner}/${repo} default branch: ${defaultBranch}`);
      return defaultBranch;
    }

    console.log(`[getRepoDefaultBranch] API returned ${response.status}, defaulting to 'main'`);
    return "main";
  } catch (error) {
    console.error("[getRepoDefaultBranch] Error:", error);
    return "main";
  }
}

/**
 * Create a GitHub repository from template, or reuse if it already exists
 * @param clientName - Name used for repo description
 * @param customRepoName - Optional custom repo name (will be sanitized)
 * @param templateRepo - Optional template repo name (defaults to GITHUB_TEMPLATE_REPO env var)
 */
async function createGitHubRepoFromTemplate(
  clientName: string,
  customRepoName?: string,
  templateRepo?: string
): Promise<{ data: { repoUrl: string; repoName: string; reused: boolean } | null; error: string | null }> {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return { data: null, error: "GITHUB_TOKEN not configured" };
    }

    // If custom repo name provided, use it directly (just sanitize without adding suffix)
    // Otherwise, derive from client name with -internal suffix
    const repoName = customRepoName 
      ? sanitizeProjectRepoName(customRepoName) 
      : sanitizeRepoName(clientName);

    // Check if repo already exists
    const { exists, repoUrl: existingRepoUrl } = await checkGitHubRepoExists(repoName);
    if (exists && existingRepoUrl) {
      console.log(`[createGitHubRepoFromTemplate] Reusing existing repo: ${existingRepoUrl}`);
      return {
        data: { repoUrl: existingRepoUrl, repoName, reused: true },
        error: null,
      };
    }

    // Use provided template or fall back to default
    const templateRepoName = templateRepo || GITHUB_TEMPLATE_REPO;

    console.log(`[createGitHubRepoFromTemplate] Creating repo: ${GITHUB_ORG}/${repoName} from template: ${templateRepoName}`);

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_ORG}/${templateRepoName}/generate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          owner: GITHUB_ORG,
          name: repoName,
          description: `Demo for ${clientName}`,
          private: false,
          include_all_branches: false,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[createGitHubRepoFromTemplate] GitHub API error:", errorData);
      return { data: null, error: `GitHub API error: ${response.status}` };
    }

    const data = await response.json();
    const repoUrl = data.html_url;

    console.log(`[createGitHubRepoFromTemplate] Created repo: ${repoUrl}`);

    return {
      data: { repoUrl, repoName, reused: false },
      error: null,
    };
  } catch (error) {
    console.error("[createGitHubRepoFromTemplate] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to create GitHub repo",
    };
  }
}

/**
 * Create an empty GitHub repository (not from template), or reuse if it already exists
 */
async function createEmptyGitHubRepo(
  projectName: string
): Promise<{ data: { repoUrl: string; repoName: string; reused: boolean } | null; error: string | null }> {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return { data: null, error: "GITHUB_TOKEN not configured" };
    }

    const repoName = sanitizeProjectRepoName(projectName);

    // Check if repo already exists
    const { exists, repoUrl: existingRepoUrl } = await checkGitHubRepoExists(repoName);
    if (exists && existingRepoUrl) {
      console.log(`[createEmptyGitHubRepo] Reusing existing repo: ${existingRepoUrl}`);
      return {
        data: { repoUrl: existingRepoUrl, repoName, reused: true },
        error: null,
      };
    }

    console.log(`[createEmptyGitHubRepo] Creating empty repo: ${GITHUB_ORG}/${repoName}`);

    const response = await fetch(
      `https://api.github.com/orgs/${GITHUB_ORG}/repos`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          name: repoName,
          description: `Project: ${projectName}`,
          private: false,
          auto_init: true, // Initialize with README so the repo isn't empty
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[createEmptyGitHubRepo] GitHub API error:", errorData);
      return { data: null, error: `GitHub API error: ${response.status}` };
    }

    const data = await response.json();
    const repoUrl = data.html_url;

    console.log(`[createEmptyGitHubRepo] Created repo: ${repoUrl}`);

    return {
      data: { repoUrl, repoName, reused: false },
      error: null,
    };
  } catch (error) {
    console.error("[createEmptyGitHubRepo] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to create GitHub repo",
    };
  }
}

/**
 * Check if a Vercel project exists by name
 */
async function checkVercelProjectExists(
  projectName: string
): Promise<{ exists: boolean; projectId: string | null }> {
  try {
    const vercelToken = process.env.VERCEL_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;

    if (!vercelToken) {
      return { exists: false, projectId: null };
    }

    const url = new URL(`https://api.vercel.com/v9/projects/${projectName}`);
    if (teamId) {
      url.searchParams.set("teamId", teamId);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { exists: true, projectId: data.id };
    }

    return { exists: false, projectId: null };
  } catch {
    return { exists: false, projectId: null };
  }
}

/**
 * Create a Vercel project linked to a GitHub repository, or reuse if it already exists
 */
async function createVercelProject(
  repoName: string,
  githubRepoFullName: string
): Promise<{ data: { projectId: string; reused: boolean } | null; error: string | null }> {
  try {
    const vercelToken = process.env.VERCEL_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;

    if (!vercelToken) {
      return { data: null, error: "VERCEL_TOKEN not configured" };
    }

    // Check if project already exists
    const { exists, projectId: existingProjectId } = await checkVercelProjectExists(repoName);
    if (exists && existingProjectId) {
      console.log(`[createVercelProject] Reusing existing project: ${existingProjectId}`);
      return {
        data: { projectId: existingProjectId, reused: true },
        error: null,
      };
    }

    console.log(`[createVercelProject] Creating Vercel project for: ${githubRepoFullName}`);

    const url = new URL("https://api.vercel.com/v9/projects");
    if (teamId) {
      url.searchParams.set("teamId", teamId);
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: repoName,
        framework: "nextjs",
        gitRepository: {
          repo: githubRepoFullName,
          type: "github",
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[createVercelProject] Vercel API error:", errorData);
      return { data: null, error: `Vercel API error: ${response.status}` };
    }

    const data = await response.json();
    const projectId = data.id;

    console.log(`[createVercelProject] Created project: ${projectId}`);

    return {
      data: { projectId, reused: false },
      error: null,
    };
  } catch (error) {
    console.error("[createVercelProject] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to create Vercel project",
    };
  }
}

/**
 * Launch a Cursor Cloud Agent to generate code
 * Uses Basic Auth as per Cursor API docs
 * @param repoUrl - The GitHub repository URL
 * @param prompt - The prompt for the agent
 * @param options - Optional settings (autoCreatePr defaults to false for demos, true for tasks)
 */
async function launchCursorAgent(
  repoUrl: string,
  prompt: string,
  options: { autoCreatePr?: boolean } = {}
): Promise<{
  data: { agentId: string; agentUrl: string; agentStatus: string } | null;
  error: string | null;
}> {
  try {
    const cursorApiKey = process.env.CURSOR_API_KEY;

    if (!cursorApiKey) {
      return { data: null, error: "CURSOR_API_KEY not configured" };
    }

    console.log(`[launchCursorAgent] Launching agent for: ${repoUrl}`);

    // Get the default branch for this repository (main or master)
    const defaultBranch = await getRepoDefaultBranch(repoUrl);
    console.log(`[launchCursorAgent] Using branch: ${defaultBranch}`);

    // Build webhook URL for completion notifications
    const webhookUrl = "https://studio.jaro.dev/api/webhooks/cursor";
    const webhookSecret = process.env.CURSOR_WEBHOOK_SECRET;

    // Request body per Cursor API docs
    const requestBody: Record<string, unknown> = {
      prompt: {
        text: prompt,
      },
      source: {
        repository: repoUrl,
        ref: defaultBranch,
      },
      target: {
        autoCreatePr: options.autoCreatePr ?? false, // Default to false for demos, tasks set to true
      },
    };

    // Include webhook configuration (secret must be 32+ chars)
    if (webhookSecret && webhookSecret.length >= 32) {
      requestBody.webhook = {
        url: webhookUrl,
        secret: webhookSecret,
      };
      console.log(`[launchCursorAgent] Webhook URL: ${webhookUrl}`);
    } else {
      // Webhook without secret verification
      requestBody.webhook = {
        url: webhookUrl,
      };
      console.log(`[launchCursorAgent] Webhook URL (no secret): ${webhookUrl}`);
    }

    // Basic Auth: API_KEY as username, empty password
    const authHeader = "Basic " + Buffer.from(`${cursorApiKey}:`).toString("base64");

    const response = await fetch("https://api.cursor.com/v0/agents", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[launchCursorAgent] Cursor API error:", errorData);
      return { data: null, error: `Cursor API error: ${response.status} - ${errorData}` };
    }

    const data = await response.json();
    const agentId = data.id;
    const agentUrl = data.target?.url || `https://cursor.com/agents?id=${agentId}`;
    const agentStatus = data.status || "CREATING";

    console.log(`[launchCursorAgent] Launched agent: ${agentId}`);
    console.log(`[launchCursorAgent] Agent URL: ${agentUrl}`);
    console.log(`[launchCursorAgent] Agent Status: ${agentStatus}`);

    return {
      data: { agentId, agentUrl, agentStatus },
      error: null,
    };
  } catch (error) {
    console.error("[launchCursorAgent] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to launch Cursor agent",
    };
  }
}

/**
 * Check Cursor agent status (for polling fallback)
 * Status values: CREATING, RUNNING, FINISHED, ERROR, STOPPED
 */
export async function checkCursorAgentStatus(
  agentId: string
): Promise<{
  data: {
    status: string;
    summary?: string;
    prUrl?: string;
    branchName?: string;
  } | null;
  error: string | null;
}> {
  try {
    const cursorApiKey = process.env.CURSOR_API_KEY;

    if (!cursorApiKey) {
      return { data: null, error: "CURSOR_API_KEY not configured" };
    }

    // Basic Auth
    const authHeader = "Basic " + Buffer.from(`${cursorApiKey}:`).toString("base64");

    const response = await fetch(`https://api.cursor.com/v0/agents/${agentId}`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[checkCursorAgentStatus] Cursor API error:", errorData);
      return { data: null, error: `Cursor API error: ${response.status}` };
    }

    const data = await response.json();

    return {
      data: {
        status: data.status, // CREATING, RUNNING, FINISHED, ERROR, STOPPED
        summary: data.summary,
        prUrl: data.target?.prUrl,
        branchName: data.target?.branchName,
      },
      error: null,
    };
  } catch (error) {
    console.error("[checkCursorAgentStatus] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to check agent status",
    };
  }
}

/**
 * Build the prompt for Cursor agent to generate the demo
 */
function buildDemoPrompt(
  requirements: ProductRequirements,
  branding: BrandInfo
): string {
  const featuresText = requirements.keyFeatures
    .map((f) => `### ${f.name}\n${f.description}`)
    .join("\n\n");

  const uiPrefsText =
    requirements.uiPreferences.length > 0
      ? `UI Preferences: ${requirements.uiPreferences.join(", ")}`
      : "";

  return `Build a complete Next.js application for "${branding.companyName}".

## Branding (CRITICAL - use these exact colors)
Update the CSS variables in app/globals.css:
- --color-primary: ${branding.primaryColor}
- --color-secondary: ${branding.secondaryColor}
- --color-accent: ${branding.accentColor}
${branding.logoUrl ? `Replace the logo with: ${branding.logoUrl}` : `Use text logo: ${branding.companyName}`}

## Application Type
${requirements.appType}

## Description
${requirements.appDescription}

## Target Users
${requirements.targetUsers}

${uiPrefsText}

## Features to Build
${featuresText}

## Requirements
- Create all necessary pages and components
- Implement working navigation between pages
- This is a real production application, NOT a mockup: every feature must be genuinely functional
- Never use placeholder, mock, dummy or hardcoded fallback data - all data must be persisted in and read from the database
- Where there is no data yet, render a proper empty state instead of fabricating content
- Ensure responsive design (mobile-first)
- Add smooth animations and transitions
- Make forms and buttons interactive
- Professional, polished appearance

## CRITICAL: Build Verification
At the end of the task, you MUST:
1. Run the build command (pnpm build or npm run build)
2. Fix ALL build errors before completing the task
3. Ensure the project compiles successfully with zero errors
4. If using third party APIs, test the GET requests to make sure the data being sent is valid and it returns a 200

Push all changes directly to the main branch.`;
}

// Tech stack options for demos
const TECH_STACK_OPTIONS = [
  "NextAuth (auth.js)",
  "Prisma",
  "NeonDB postgres",
  "Next.js",
  "TailwindCSS",
  "ShadCN",
  "Puppeteer",
  "Stripe",
] as const;

export type TechStackOption = (typeof TECH_STACK_OPTIONS)[number];

interface EnhancedPromptOptions {
  name: string;
  prompt: string;
  systemRequirements?: string[] | null;
  mvpQuoteData?: {
    companyName: string;
    productSummary: unknown; // JSON object with pages, apis, customLogic
    lineItems: unknown; // JSON array of line items
    total: number;
  } | null;
  techStack?: string[];
}

/**
 * Build an enhanced prompt for Cursor agent that includes:
 * - Instructions to create PLAN.md first
 * - Full call transcript context
 * - MVP quote details
 * - Tech stack requirements
 */
function buildEnhancedDemoPrompt(options: EnhancedPromptOptions): string {
  const { name, prompt, systemRequirements, mvpQuoteData, techStack } = options;

  let enhancedPrompt = `# ${name}

## PHASE 1: Create Implementation Plan (CRITICAL - DO THIS FIRST)

Before writing any code, you MUST create a PLAN.md file in the root of the repository with the following structure:

\`\`\`markdown
# Implementation Plan

## Overview
Brief description of what we're building.

## Architecture
- Tech stack decisions
- Key architectural choices

## Implementation Steps
1. [Step 1 description]
2. [Step 2 description]
3. [Step 3 description]
...

## File Structure
- List of files/folders to create

## Key Decisions
- Important decisions made and rationale
\`\`\`

## PHASE 2: Implement First Steps

After creating PLAN.md, implement the first 3-5 bullet points from your implementation plan.

---

## Project Requirements

${prompt}
`;

  // Add tech stack section if provided
  if (techStack && techStack.length > 0) {
    enhancedPrompt += `
## Tech Stack Requirements (USE THESE TECHNOLOGIES)

The following technologies MUST be used in this project:
${techStack.map((tech) => `- ${tech}`).join("\n")}

Make sure to properly configure and integrate each of these technologies.
`;
  }

  // Add MVP quote context if provided
  if (mvpQuoteData) {
    const productSummary = mvpQuoteData.productSummary as {
      pages?: Array<{ name: string; description: string }>;
      apis?: Array<{ name: string; description: string }>;
      customLogic?: Array<{ name: string; description: string }>;
    };

    enhancedPrompt += `
## MVP Quote Details (Product Specification)

Company: ${mvpQuoteData.companyName}
Estimated Budget: $${mvpQuoteData.total.toLocaleString()}

### Pages to Build
${productSummary.pages?.map((p) => `- **${p.name}**: ${p.description}`).join("\n") || "No specific pages defined"}

### External API Integrations
${productSummary.apis?.map((a) => `- **${a.name}**: ${a.description}`).join("\n") || "No external APIs"}

### Custom Logic/Features
${productSummary.customLogic?.map((c) => `- **${c.name}**: ${c.description}`).join("\n") || "No custom logic defined"}
`;
  }

  // Add system requirements extracted from transcript
  if (systemRequirements && systemRequirements.length > 0) {
    enhancedPrompt += `
## System Requirements (Extracted from Discovery Call)

These requirements were extracted from the client discovery/sales call. Implement ALL of them:

${JSON.stringify(systemRequirements, null, 2)}
`;
  }

  // Add critical build verification section
  enhancedPrompt += `
## CRITICAL: Build Verification

At the end of the task, you MUST:
1. Run the build command (pnpm build or npm run build)
2. Fix ALL build errors before completing the task
3. Ensure the project compiles successfully with zero errors
4. If using third party APIs, test the GET requests to make sure the data being sent is valid and it returns a 200

Push all changes directly to the main branch.
`;

  return enhancedPrompt;
}

interface ProvisionedBuild {
  repoUrl: string;
  repoName: string;
  vercelProjectId: string;
  cursorAgentId: string | null;
  cursorAgentUrl: string | null;
  cursorAgentStatus: string | null;
  cursorError: string | null;
}

/**
 * Provision the infrastructure for a build: GitHub repo from template -> Vercel project -> Cursor agent.
 * A non-null cursorError means the repo and Vercel project exist but the agent failed to launch,
 * so the caller can still persist the repo details alongside a failed status.
 */
async function provisionBuild(options: {
  clientCompanyName: string;
  prompt: string;
  templateRepo?: string;
  customRepoName?: string;
}): Promise<{ data: ProvisionedBuild | null; error: string | null }> {
  const { clientCompanyName, prompt, templateRepo, customRepoName } = options;

  console.log("[provisionBuild] Creating GitHub repo from template:", templateRepo || "default");
  const { data: repoData, error: repoError } = await createGitHubRepoFromTemplate(
    clientCompanyName,
    customRepoName,
    templateRepo
  );
  if (repoError || !repoData) {
    console.error("[provisionBuild] Failed to create GitHub repo:", repoError);
    return { data: null, error: repoError || "Failed to create GitHub repo" };
  }

  console.log("[provisionBuild] Creating Vercel project for repo:", repoData.repoName);
  const { data: vercelData, error: vercelError } = await createVercelProject(
    repoData.repoName,
    `${GITHUB_ORG}/${repoData.repoName}`
  );
  if (vercelError || !vercelData) {
    console.error("[provisionBuild] Failed to create Vercel project:", vercelError);
    return { data: null, error: vercelError || "Failed to create Vercel project" };
  }

  console.log("[provisionBuild] Launching Cursor agent...");
  const { data: cursorData, error: cursorError } = await launchCursorAgent(
    repoData.repoUrl,
    prompt
  );
  if (cursorError || !cursorData) {
    console.error("[provisionBuild] Failed to launch Cursor agent:", cursorError);
    return {
      data: {
        repoUrl: repoData.repoUrl,
        repoName: repoData.repoName,
        vercelProjectId: vercelData.projectId,
        cursorAgentId: null,
        cursorAgentUrl: null,
        cursorAgentStatus: null,
        cursorError: cursorError || "Failed to launch Cursor agent",
      },
      error: null,
    };
  }

  console.log("[provisionBuild] Provisioning complete, agent:", cursorData.agentId);
  return {
    data: {
      repoUrl: repoData.repoUrl,
      repoName: repoData.repoName,
      vercelProjectId: vercelData.projectId,
      cursorAgentId: cursorData.agentId,
      cursorAgentUrl: cursorData.agentUrl,
      cursorAgentStatus: cursorData.agentStatus,
      cursorError: null,
    },
    error: null,
  };
}

/**
 * Build the Cursor agent prompt for a build driven by a sales call:
 * scrape the client's branding and extract product requirements from the transcript
 */
async function buildCallDrivenPrompt(options: {
  clientCompanyName: string;
  clientEmail: string;
  transcript: string;
  website?: string | null;
}): Promise<string> {
  const { clientCompanyName, clientEmail, transcript, website } = options;

  // Determine domain for branding - prefer website, fall back to email domain
  let domain: string | null = null;
  if (website) {
    domain = website;
    console.log("[buildCallDrivenPrompt] Using website:", domain);
  } else if (clientEmail) {
    const emailDomain = extractDomainFromEmail(clientEmail);
    const genericDomains = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "me.com", "live.com", "msn.com"];
    if (emailDomain && !genericDomains.includes(emailDomain.toLowerCase())) {
      domain = emailDomain;
      console.log("[buildCallDrivenPrompt] Using email domain:", domain);
    } else {
      console.log("[buildCallDrivenPrompt] Email domain is generic or empty:", emailDomain);
    }
  }

  let branding: BrandInfo;
  if (domain) {
    branding = await scrapeBrandFromDomain(domain);
  } else {
    console.log("[buildCallDrivenPrompt] No domain available, using default branding");
    branding = {
      logoUrl: null,
      primaryColor: "#3B82F6",
      secondaryColor: "#1E293B",
      accentColor: "#10B981",
      companyName: clientCompanyName,
    };
  }
  // Use the client company name from our records
  branding.companyName = clientCompanyName;

  console.log("[buildCallDrivenPrompt] Brand info:", branding);

  console.log("[buildCallDrivenPrompt] Extracting product requirements from transcript...");
  const { data: requirements, error: requirementsError } =
    await extractProductRequirements(transcript);

  if (requirementsError || !requirements) {
    console.error("[buildCallDrivenPrompt] Failed to extract requirements:", requirementsError);
    throw new Error(
      requirementsError || "Failed to extract product requirements from the call transcript"
    );
  }

  console.log("[buildCallDrivenPrompt] Requirements extracted, building prompt...");
  return buildDemoPrompt(requirements, branding);
}

/**
 * Append admin-provided context to a generated prompt
 */
function appendAdditionalContext(prompt: string, additionalContext?: string | null): string {
  const trimmed = additionalContext?.trim();
  if (!trimmed) {
    return prompt;
  }

  return `${prompt}

## Additional Context from Jaro.dev

${trimmed}`;
}

/**
 * Generate a demo for a new client company after a sales call
 * This orchestrates the full flow: scrape brand -> extract requirements -> create GitHub repo -> create Vercel project -> launch Cursor agent
 */
export async function generateClientDemo(
  clientCompanyId: string,
  clientCompanyName: string,
  clientEmail: string,
  transcript: string,
  website?: string | null,
  customRepoName?: string,
  templateRepo?: string
): Promise<{ data: { demoId: string; slug: string | null } | null; error: string | null }> {
  try {
    console.log("[generateClientDemo] Starting demo generation for:", clientCompanyName);

    // Step 1: Scrape branding and extract requirements to build the agent prompt
    const prompt = await buildCallDrivenPrompt({
      clientCompanyName,
      clientEmail,
      transcript,
      website,
    });

    // Step 2: Provision GitHub repo, Vercel project and Cursor agent
    console.log("[generateClientDemo] Using template:", templateRepo || "default");
    const { data: provisioned, error: provisionError } = await provisionBuild({
      clientCompanyName,
      prompt,
      templateRepo,
      customRepoName,
    });
    if (provisionError || !provisioned) {
      console.error("[generateClientDemo] Failed to provision build:", provisionError);
      return { data: null, error: provisionError || "Failed to provision build" };
    }

    // Step 3: Create demo record
    const demo = await prisma.demo.create({
      data: {
        name: `${clientCompanyName} - Product Demo`,
        slug: await generateUniqueSlug(clientCompanyName),
        prompt: prompt,
        status: provisioned.cursorError ? "failed" : "generating",
        errorMessage: provisioned.cursorError,
        githubRepoUrl: provisioned.repoUrl,
        githubRepoName: provisioned.repoName,
        templateRepo: templateRepo || null,
        cursorAgentId: provisioned.cursorAgentId,
        cursorAgentUrl: provisioned.cursorAgentUrl,
        cursorAgentStatus: provisioned.cursorAgentStatus,
        vercelProjectId: provisioned.vercelProjectId,
        clientCompanyId: clientCompanyId,
      },
    });

    console.log("[generateClientDemo] Demo created:", demo.id, "Slug:", demo.slug, "Status:", demo.status);
    console.log("[generateClientDemo] GitHub repo:", provisioned.repoUrl);

    revalidatePath("/dashboard/demos");

    return {
      data: { demoId: demo.id, slug: demo.slug },
      error: provisioned.cursorError,
    };
  } catch (error) {
    console.error("[generateClientDemo] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to generate client demo",
    };
  }
}

// ============================================
// PRODUCT BUILD APPROVAL QUEUE
// ============================================

/**
 * Queue a product build for admin approval after a sales call.
 * Generates the prompt up front (branding + requirements) but provisions nothing:
 * the repo, Vercel project and Cursor agent are only created on approval.
 */
export async function queueProductBuild(options: {
  clientCompanyId: string;
  clientCompanyName: string;
  clientEmail: string;
  transcript: string;
  website?: string | null;
  meetingId?: string | null;
}): Promise<{ data: { demoId: string } | null; error: string | null }> {
  const { clientCompanyId, clientCompanyName, clientEmail, transcript, website, meetingId } = options;

  try {
    console.log("[queueProductBuild] Queueing product build for:", clientCompanyName);

    console.log("[queueProductBuild] Building prompt from call transcript...");
    const prompt = await buildCallDrivenPrompt({
      clientCompanyName,
      clientEmail,
      transcript,
      website,
    });

    console.log("[queueProductBuild] Creating queued build record...");
    const demo = await prisma.demo.create({
      data: {
        name: `${clientCompanyName} - Product`,
        slug: await generateUniqueSlug(clientCompanyName),
        prompt,
        status: "queued",
        clientCompanyId,
        meetingId: meetingId || null,
      },
    });

    console.log("[queueProductBuild] Build queued for approval, id:", demo.id);
    revalidatePath("/dashboard/demos");
    revalidatePath("/dashboard/calls");

    return { data: { demoId: demo.id }, error: null };
  } catch (error) {
    console.error("[queueProductBuild] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to queue product build",
    };
  }
}

/**
 * Queue a product build from a past meeting, for calls where the automatic criteria
 * didn't trigger one. The company can be supplied when the meeting isn't linked to one.
 */
export async function queueProductBuildFromMeeting(
  meetingId: string,
  clientCompanyId?: string
): Promise<{
  data: { demoId: string; clientCompanyId: string; clientCompanyName: string } | null;
  error: string | null;
}> {
  try {
    console.log("[queueProductBuildFromMeeting] Queueing build from meeting:", meetingId);

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can queue builds" };
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { clientCompany: true },
    });

    if (!meeting) {
      return { data: null, error: "Meeting not found" };
    }

    if (!meeting.formattedTranscript) {
      return { data: null, error: "This meeting has no transcript to build from" };
    }

    console.log("[queueProductBuildFromMeeting] Resolving client company...");
    const company =
      meeting.clientCompany ||
      (clientCompanyId
        ? await prisma.company.findUnique({ where: { id: clientCompanyId } })
        : null);

    if (!company) {
      return { data: null, error: "Select a client company for this build" };
    }

    console.log("[queueProductBuildFromMeeting] Checking for existing builds...");
    const existingBuildCount = await prisma.demo.count({
      where: {
        clientCompanyId: company.id,
        status: { not: "rejected" },
      },
    });

    if (existingBuildCount > 0) {
      return { data: null, error: `A build already exists for ${company.name}` };
    }

    // Attribute the call to the chosen company so the build shows up against it later
    if (!meeting.clientCompanyId) {
      console.log("[queueProductBuildFromMeeting] Linking meeting to company:", company.name);
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { clientCompanyId: company.id },
      });
    }

    const clientEmail = meeting.participants.find((email) => !isJaroDevTeamEmail(email)) || "";

    const { data, error } = await queueProductBuild({
      clientCompanyId: company.id,
      clientCompanyName: company.name,
      clientEmail,
      transcript: meeting.formattedTranscript,
      website: company.website,
      meetingId: meeting.id,
    });

    if (error || !data) {
      return { data: null, error: error || "Failed to queue build" };
    }

    return {
      data: {
        demoId: data.demoId,
        clientCompanyId: company.id,
        clientCompanyName: company.name,
      },
      error: null,
    };
  } catch (error) {
    console.error("[queueProductBuildFromMeeting] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to queue build from meeting",
    };
  }
}

/**
 * Approve a queued product build: append the admin's extra context to the generated
 * prompt and run the provisioning pipeline against the chosen template repo
 */
export async function approveProductBuild(
  demoId: string,
  options: { templateRepo: string; additionalContext?: string; mvpCallMapId?: string }
): Promise<{ data: { demoId: string } | null; error: string | null }> {
  try {
    console.log("[approveProductBuild] Approving build:", demoId);

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can approve builds" };
    }

    if (!options.templateRepo) {
      return { data: null, error: "A template repository is required" };
    }

    const demo = await prisma.demo.findUnique({
      where: { id: demoId },
      include: { clientCompany: { select: { name: true } } },
    });

    if (!demo) {
      return { data: null, error: "Build not found" };
    }

    if (demo.status !== "queued") {
      return { data: null, error: "Only queued builds can be approved" };
    }

    const buildName = demo.clientCompany?.name || demo.name;

    let promptWithCallMap = demo.prompt;
    if (options.mvpCallMapId) {
      console.log("[approveProductBuild] Loading MVP call map:", options.mvpCallMapId);
      const callMap = await prisma.mVPCallMap.findUnique({
        where: { id: options.mvpCallMapId },
        select: { name: true, notes: true, flowData: true, configuratorData: true },
      });

      if (!callMap) {
        return { data: null, error: "MVP call map not found" };
      }

      const callMapContext = buildMVPCallMapContext(callMap);
      if (callMapContext) {
        console.log("[approveProductBuild] Adding call map context to prompt:", callMap.name);
        promptWithCallMap = `${demo.prompt}\n${callMapContext}`;
      } else {
        console.log("[approveProductBuild] Call map has no scope data, skipping context");
      }
    }

    const finalPrompt = appendAdditionalContext(promptWithCallMap, options.additionalContext);

    console.log("[approveProductBuild] Provisioning build with template:", options.templateRepo);
    const { data: provisioned, error: provisionError } = await provisionBuild({
      clientCompanyName: buildName,
      prompt: finalPrompt,
      templateRepo: options.templateRepo,
    });

    if (provisionError || !provisioned) {
      console.error("[approveProductBuild] Provisioning failed:", provisionError);
      await prisma.demo.update({
        where: { id: demoId },
        data: {
          status: "failed",
          errorMessage: provisionError || "Failed to provision build",
          templateRepo: options.templateRepo,
          additionalContext: options.additionalContext?.trim() || null,
          mvpCallMapId: options.mvpCallMapId || null,
          prompt: finalPrompt,
          approvedAt: new Date(),
          approvedById: currentUser.id,
        },
      });
      return { data: null, error: provisionError || "Failed to provision build" };
    }

    console.log("[approveProductBuild] Saving approved build...");
    await prisma.demo.update({
      where: { id: demoId },
      data: {
        status: provisioned.cursorError ? "failed" : "generating",
        errorMessage: provisioned.cursorError,
        prompt: finalPrompt,
        additionalContext: options.additionalContext?.trim() || null,
        mvpCallMapId: options.mvpCallMapId || null,
        templateRepo: options.templateRepo,
        githubRepoUrl: provisioned.repoUrl,
        githubRepoName: provisioned.repoName,
        cursorAgentId: provisioned.cursorAgentId,
        cursorAgentUrl: provisioned.cursorAgentUrl,
        cursorAgentStatus: provisioned.cursorAgentStatus,
        vercelProjectId: provisioned.vercelProjectId,
        rejectionReason: null,
        approvedAt: new Date(),
        approvedById: currentUser.id,
      },
    });

    console.log("[approveProductBuild] Build approved and started:", demoId);
    revalidatePath("/dashboard/demos");

    return { data: { demoId }, error: provisioned.cursorError };
  } catch (error) {
    console.error("[approveProductBuild] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to approve build",
    };
  }
}

/**
 * Reject a queued product build, keeping the record for reference
 */
export async function rejectProductBuild(
  demoId: string,
  reason?: string
): Promise<{ data: { demoId: string } | null; error: string | null }> {
  try {
    console.log("[rejectProductBuild] Rejecting build:", demoId);

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can reject builds" };
    }

    const demo = await prisma.demo.findUnique({
      where: { id: demoId },
      select: { status: true },
    });

    if (!demo) {
      return { data: null, error: "Build not found" };
    }

    if (demo.status !== "queued") {
      return { data: null, error: "Only queued builds can be rejected" };
    }

    await prisma.demo.update({
      where: { id: demoId },
      data: {
        status: "rejected",
        rejectionReason: reason?.trim() || null,
      },
    });

    console.log("[rejectProductBuild] Build rejected:", demoId);
    revalidatePath("/dashboard/demos");

    return { data: { demoId }, error: null };
  } catch (error) {
    console.error("[rejectProductBuild] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to reject build",
    };
  }
}

// Demo actions - Cursor Cloud Pipeline

export async function createDemo(data: {
  name: string;
  prompt: string;
  clientCompanyId?: string;
  templateRepo?: string;
  meetingId?: string;
  mvpSharedQuoteId?: string;
  techStack?: string[];
}) {
  try {
    console.log("[createDemo] Starting demo creation:", data.name);
    console.log("[createDemo] Template repo:", data.templateRepo || "default");
    console.log("[createDemo] Meeting ID:", data.meetingId || "none");
    console.log("[createDemo] MVP Quote ID:", data.mvpSharedQuoteId || "none");
    console.log("[createDemo] Tech stack:", data.techStack?.join(", ") || "none");

    // Step 1: Fetch additional context if meeting or quote is provided
    let transcript: string | null = null;
    let mvpQuoteData: {
      companyName: string;
      productSummary: unknown;
      lineItems: unknown;
      total: number;
    } | null = null;

    if (data.meetingId) {
      console.log("[createDemo] Fetching meeting transcript...");
      const meeting = await prisma.meeting.findUnique({
        where: { id: data.meetingId },
        select: { formattedTranscript: true },
      });
      if (meeting) {
        transcript = meeting.formattedTranscript;
        console.log("[createDemo] Transcript fetched, length:", transcript?.length || 0);
      }
    }

    if (data.mvpSharedQuoteId) {
      console.log("[createDemo] Fetching MVP quote details...");
      const quote = await prisma.mVPSharedQuote.findUnique({
        where: { id: data.mvpSharedQuoteId },
        select: {
          companyName: true,
          productSummary: true,
          lineItems: true,
          total: true,
        },
      });
      if (quote) {
        mvpQuoteData = {
          companyName: quote.companyName,
          productSummary: quote.productSummary,
          lineItems: quote.lineItems,
          total: quote.total,
        };
        console.log("[createDemo] MVP quote fetched for:", mvpQuoteData.companyName);
      }
    }

    // Step 2: Extract system requirements from transcript if available
    let systemRequirements: string[] | null = null;
    if (transcript) {
      console.log("[createDemo] Extracting system requirements from transcript...");
      const { data: reqs, error: reqsError } = await extractSystemRequirementsFromTranscript(transcript);
      if (reqsError || !reqs) {
        console.warn("[createDemo] Failed to extract requirements:", reqsError);
      } else {
        systemRequirements = reqs;
        console.log("[createDemo] Extracted", systemRequirements.length, "requirements from transcript");
      }
    }

    // Step 3: Build enhanced prompt if we have additional context
    let finalPrompt = data.prompt;
    if (systemRequirements || mvpQuoteData || (data.techStack && data.techStack.length > 0)) {
      console.log("[createDemo] Building enhanced prompt with context...");
      finalPrompt = buildEnhancedDemoPrompt({
        name: data.name,
        prompt: data.prompt,
        systemRequirements,
        mvpQuoteData,
        techStack: data.techStack,
      });
    }

    // Step 4: Create GitHub repo from template
    const { data: repoData, error: repoError } = await createGitHubRepoFromTemplate(
      data.name,
      undefined,
      data.templateRepo
    );
    if (repoError || !repoData) {
      return { data: null, error: repoError || "Failed to create GitHub repo" };
    }

    // Step 5: Create Vercel project linked to repo
    const githubRepoFullName = `${GITHUB_ORG}/${repoData.repoName}`;
    const { data: vercelData, error: vercelError } = await createVercelProject(
      repoData.repoName,
      githubRepoFullName
    );
    if (vercelError || !vercelData) {
      return { data: null, error: vercelError || "Failed to create Vercel project" };
    }

    // Step 6: Launch Cursor agent
    const { data: cursorData, error: cursorError } = await launchCursorAgent(
      repoData.repoUrl,
      finalPrompt
    );

    // Create demo record with all new fields
    const demo = await prisma.demo.create({
      data: {
        name: data.name,
        slug: generateSlug(data.name),
        prompt: finalPrompt,
        status: cursorError ? "failed" : "generating",
        errorMessage: cursorError || null,
        githubRepoUrl: repoData.repoUrl,
        githubRepoName: repoData.repoName,
        templateRepo: data.templateRepo || null,
        cursorAgentId: cursorData?.agentId || null,
        cursorAgentUrl: cursorData?.agentUrl || null,
        cursorAgentStatus: cursorData?.agentStatus || null,
        vercelProjectId: vercelData.projectId,
        clientCompanyId: data.clientCompanyId,
        meetingId: data.meetingId || null,
        mvpSharedQuoteId: data.mvpSharedQuoteId || null,
        techStack: data.techStack || [],
      },
    });

    console.log("[createDemo] Demo created:", demo.id);
    revalidatePath("/dashboard/demos");
    return { data: demo, error: cursorError };
  } catch (error) {
    console.error("Error creating demo:", error);
    return { data: null, error: error instanceof Error ? error.message : "Failed to create demo" };
  }
}

/**
 * Create a new project with empty GitHub repo (not from template), Vercel project, and Cursor agent
 */
export async function createProject(data: {
  name: string;
  prompt: string;
}) {
  try {
    // Step 1: Create empty GitHub repo (not from template, no -internal suffix)
    const { data: repoData, error: repoError } = await createEmptyGitHubRepo(data.name);
    if (repoError || !repoData) {
      return { data: null, error: repoError || "Failed to create GitHub repo" };
    }

    // Step 2: Create Vercel project linked to repo
    const githubRepoFullName = `${GITHUB_ORG}/${repoData.repoName}`;
    const { data: vercelData, error: vercelError } = await createVercelProject(
      repoData.repoName,
      githubRepoFullName
    );
    if (vercelError || !vercelData) {
      return { data: null, error: vercelError || "Failed to create Vercel project" };
    }

    // Step 3: Launch Cursor agent
    const { data: cursorData, error: cursorError } = await launchCursorAgent(
      repoData.repoUrl,
      data.prompt
    );

    // Create demo record (reusing Demo model for project tracking)
    const demo = await prisma.demo.create({
      data: {
        name: data.name,
        slug: generateSlug(data.name),
        prompt: data.prompt,
        status: cursorError ? "failed" : "generating",
        errorMessage: cursorError || null,
        githubRepoUrl: repoData.repoUrl,
        githubRepoName: repoData.repoName,
        cursorAgentId: cursorData?.agentId || null,
        cursorAgentUrl: cursorData?.agentUrl || null,
        cursorAgentStatus: cursorData?.agentStatus || null,
        vercelProjectId: vercelData.projectId,
      },
    });

    revalidatePath("/dashboard/demos");
    return { data: demo, error: cursorError };
  } catch (error) {
    console.error("Error creating project:", error);
    return { data: null, error: error instanceof Error ? error.message : "Failed to create project" };
  }
}

export async function updateDemo(
  id: string,
  data: {
    name?: string;
  }
) {
  try {
    const demo = await prisma.demo.update({
      where: { id },
      data: {
        name: data.name,
      },
    });

    revalidatePath("/dashboard/demos");
    revalidatePath(`/demo/${id}`);
    return { data: demo, error: null };
  } catch (error) {
    console.error("Error updating demo:", error);
    return { data: null, error: "Failed to update demo" };
  }
}

/**
 * Manually set a demo as deployed/ready
 */
export async function setDemoAsDeployed(
  id: string,
  deployUrl?: string
) {
  try {
    const demo = await prisma.demo.findUnique({
      where: { id },
    });

    if (!demo) {
      return { data: null, error: "Demo not found" };
    }

    // Build deploy URL from repo name if not provided
    const vercelDeployUrl = deployUrl || 
      (demo.githubRepoName ? `https://${demo.githubRepoName}.vercel.app` : null);

    const updatedDemo = await prisma.demo.update({
      where: { id },
      data: {
        status: "ready",
        vercelDeployUrl,
        errorMessage: null,
      },
    });

    revalidatePath("/dashboard/demos");
    revalidatePath(`/demo/${id}`);
    return { data: updatedDemo, error: null };
  } catch (error) {
    console.error("Error setting demo as deployed:", error);
    return { data: null, error: "Failed to set demo as deployed" };
  }
}

export async function deleteDemo(id: string) {
  try {
    await prisma.demo.delete({
      where: { id },
    });

    revalidatePath("/dashboard/demos");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting demo:", error);
    return { data: null, error: "Failed to delete demo" };
  }
}

/**
 * Delete a GitHub repository
 */
async function deleteGitHubRepo(
  repoName: string
): Promise<{ data: boolean | null; error: string | null }> {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return { data: null, error: "GITHUB_TOKEN not configured" };
    }

    console.log(`[deleteGitHubRepo] Deleting repo: ${GITHUB_ORG}/${repoName}`);

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_ORG}/${repoName}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const errorData = await response.text();
      console.error("[deleteGitHubRepo] GitHub API error:", errorData);
      return { data: null, error: `GitHub API error: ${response.status}` };
    }

    console.log("[deleteGitHubRepo] Deleted repo successfully");
    return { data: true, error: null };
  } catch (error) {
    console.error("[deleteGitHubRepo] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to delete GitHub repo",
    };
  }
}

/**
 * Delete a Vercel project
 */
async function deleteVercelProject(
  projectId: string
): Promise<{ data: boolean | null; error: string | null }> {
  try {
    const vercelToken = process.env.VERCEL_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;

    if (!vercelToken) {
      return { data: null, error: "VERCEL_TOKEN not configured" };
    }

    console.log(`[deleteVercelProject] Deleting project: ${projectId}`);

    const url = new URL(`https://api.vercel.com/v9/projects/${projectId}`);
    if (teamId) {
      url.searchParams.set("teamId", teamId);
    }

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorData = await response.text();
      console.error("[deleteVercelProject] Vercel API error:", errorData);
      return { data: null, error: `Vercel API error: ${response.status}` };
    }

    console.log("[deleteVercelProject] Deleted project successfully");
    return { data: true, error: null };
  } catch (error) {
    console.error("[deleteVercelProject] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to delete Vercel project",
    };
  }
}

/**
 * Delete a demo with full cleanup (GitHub repo + Vercel project + DB record)
 */
export async function deleteDemoWithCleanup(
  id: string,
  options: { deleteGitHub?: boolean; deleteVercel?: boolean } = {}
): Promise<{ data: { deleted: boolean; errors: string[] } | null; error: string | null }> {
  try {
    const demo = await prisma.demo.findUnique({
      where: { id },
    });

    if (!demo) {
      return { data: null, error: "Demo not found" };
    }

    const errors: string[] = [];

    // Delete GitHub repo if requested and exists
    if (options.deleteGitHub && demo.githubRepoName) {
      const { error: githubError } = await deleteGitHubRepo(demo.githubRepoName);
      if (githubError) {
        errors.push(`GitHub: ${githubError}`);
      }
    }

    // Delete Vercel project if requested and exists
    if (options.deleteVercel && demo.vercelProjectId) {
      const { error: vercelError } = await deleteVercelProject(demo.vercelProjectId);
      if (vercelError) {
        errors.push(`Vercel: ${vercelError}`);
      }
    }

    // Delete demo record from database
    await prisma.demo.delete({
      where: { id },
    });

    revalidatePath("/dashboard/demos");

    return {
      data: { deleted: true, errors },
      error: errors.length > 0 ? `Partial cleanup: ${errors.join(", ")}` : null,
    };
  } catch (error) {
    console.error("Error deleting demo with cleanup:", error);
    return { data: null, error: error instanceof Error ? error.message : "Failed to delete demo" };
  }
}

/**
 * Preview what would be created for a demo (dry run)
 */
export async function previewDemoGeneration(
  clientCompanyId: string
): Promise<{
  data: {
    clientCompany: { id: string; name: string };
    proposedRepoName: string;
    branding: BrandInfo | null;
    requirements: ProductRequirements | null;
    transcript: string | null;
  } | null;
  error: string | null;
}> {
  try {
    // Get client company with latest meeting
    const clientCompany = await prisma.company.findUnique({
      where: { id: clientCompanyId },
      include: {
        meetings: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        users: {
          take: 1,
          select: { email: true },
        },
        demos: {
          select: { id: true },
        },
      },
    });

    if (!clientCompany) {
      return { data: null, error: "Client company not found" };
    }

    // Get domain for branding - prefer website field, fall back to email domain
    let domain: string | null = null;
    if (clientCompany.website) {
      // Use the website field directly
      domain = clientCompany.website;
      console.log("[previewDemoGeneration] Using website field:", domain);
    } else {
      // Fall back to extracting from user email
      const clientEmail = clientCompany.users[0]?.email;
      if (clientEmail) {
        const emailDomain = extractDomainFromEmail(clientEmail);
        // Skip common email providers
        const genericDomains = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "me.com", "live.com", "msn.com"];
        if (emailDomain && !genericDomains.includes(emailDomain.toLowerCase())) {
          domain = emailDomain;
          console.log("[previewDemoGeneration] Using email domain:", domain);
        } else {
          console.log("[previewDemoGeneration] Email domain is generic or empty:", emailDomain);
        }
      } else {
        console.log("[previewDemoGeneration] No users found for client company");
      }
    }

    // Get branding
    let branding: BrandInfo | null = null;
    if (domain) {
      try {
        branding = await scrapeBrandFromDomain(domain);
        branding.companyName = clientCompany.name;
      } catch (err) {
        console.error("[previewDemoGeneration] Failed to scrape brand:", err);
        branding = null;
      }
    } else {
      console.log("[previewDemoGeneration] No domain available for branding");
    }

    // Get transcript and requirements
    const transcript = clientCompany.meetings[0]?.formattedTranscript || null;
    let requirements: ProductRequirements | null = null;
    if (transcript) {
      const { data } = await extractProductRequirements(transcript);
      requirements = data;
    }

    // Calculate proposed repo name
    const proposedRepoName = sanitizeRepoName(clientCompany.name);

    return {
      data: {
        clientCompany: { id: clientCompany.id, name: clientCompany.name },
        proposedRepoName,
        branding,
        requirements,
        transcript: transcript ? transcript.substring(0, 500) + "..." : null,
      },
      error: null,
    };
  } catch (error) {
    console.error("Error previewing demo generation:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to preview demo generation",
    };
  }
}

/**
 * Generate demo for a specific client company (manual trigger)
 */
export async function generateDemoForClientCompany(
  clientCompanyId: string,
  customRepoName?: string,
  templateRepo?: string
): Promise<{ data: { demoId: string } | null; error: string | null }> {
  try {
    if (!templateRepo) {
      return { data: null, error: "A template repository is required" };
    }

    // Get client company with latest meeting
    const clientCompany = await prisma.company.findUnique({
      where: { id: clientCompanyId },
      include: {
        meetings: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        users: {
          take: 1,
          select: { email: true },
        },
        demos: {
          where: { status: { not: "rejected" } },
          select: { id: true },
        },
      },
    });

    if (!clientCompany) {
      return { data: null, error: "Client company not found" };
    }

    // Check if a build already exists (rejected ones don't count)
    if (clientCompany.demos.length > 0) {
      return { data: null, error: "A build already exists for this client" };
    }

    // Get email and website for branding
    const clientEmail = clientCompany.users[0]?.email || "";
    const transcript = clientCompany.meetings[0]?.formattedTranscript || "";

    // Use the existing generateClientDemo function
    return await generateClientDemo(
      clientCompanyId,
      clientCompany.name,
      clientEmail,
      transcript,
      clientCompany.website,
      customRepoName,
      templateRepo
    );
  } catch (error) {
    console.error("Error generating demo for client:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to generate demo",
    };
  }
}

/**
 * Regenerate a demo by launching a new Cursor agent with the same prompt
 */
export async function regenerateDemo(id: string) {
  try {
    const existingDemo = await prisma.demo.findUnique({
      where: { id },
    });

    if (!existingDemo) {
      return { data: null, error: "Demo not found" };
    }

    if (!existingDemo.githubRepoUrl) {
      return { data: null, error: "Demo does not have a GitHub repo" };
    }

    // Launch a new Cursor agent with the same prompt
    const { data: cursorData, error: cursorError } = await launchCursorAgent(
      existingDemo.githubRepoUrl,
      existingDemo.prompt
    );

    if (cursorError || !cursorData) {
      // Update demo with error
      await prisma.demo.update({
        where: { id },
        data: {
          status: "failed",
          errorMessage: cursorError || "Failed to launch Cursor agent",
        },
      });
      return { data: null, error: cursorError };
    }

    // Update demo with new agent ID and generating status
    const demo = await prisma.demo.update({
      where: { id },
      data: {
        status: "generating",
        errorMessage: null,
        cursorAgentId: cursorData.agentId,
        cursorAgentUrl: cursorData.agentUrl,
        cursorAgentStatus: cursorData.agentStatus,
        vercelDeployUrl: null, // Clear old deploy URL
      },
    });

    revalidatePath("/dashboard/demos");
    revalidatePath(`/demo/${id}`);
    return { data: demo, error: null };
  } catch (error) {
    console.error("Error regenerating demo:", error);
    return { data: null, error: error instanceof Error ? error.message : "Failed to regenerate demo" };
  }
}

// Technology and Service labels for prompt
const technologyLabels: Record<string, string> = {
  NEXTJS_APP_ROUTER: "Next.js App Router",
  JAVASCRIPT: "JavaScript",
  TYPESCRIPT: "TypeScript",
  REACT: "React",
  TAILWIND_CSS: "Tailwind CSS",
  PLANETSCALE: "Planetscale",
  VERCEL: "Vercel",
  PRISMA: "Prisma",
  GOOGLE_CLOUD_FUNCTIONS: "Google Cloud Functions",
  UNIT_TESTING: "Unit Testing",
  PLAYWRIGHT: "Playwright",
  PUPPETEER: "Puppeteer",
  MONGODB: "MongoDB",
  NEON_POSTGRES: "Neon Postgres",
  CHATGPT: "ChatGPT",
  CLAUDE: "Claude",
};

const serviceLabels: Record<string, string> = {
  SCRAPING: "Scraping",
  INTERNAL_WEB_APPLICATION: "Internal Web Application",
  SAAS: "SaaS",
  PWA: "PWA",
  ARCHITECTURE_CONSULTING: "Architecture Consulting",
  ETL: "ETL",
  AUTOMATION: "Automation",
  AI_INTEGRATION: "AI Integration",
  UI_UX_DESIGN: "UI/UX Design",
  CI_CD_INFRASTRUCTURE_SETUP: "CI/CD & Infrastructure Setup",
};

export async function generateCaseStudyText(data: {
  name: string;
  companyName?: string;
  body: string;
  technologies: string[];
  services: string[];
  publicUrl?: string;
}) {
  try {
    const techList = data.technologies.map(t => technologyLabels[t] || t).join(", ");
    const serviceList = data.services.map(s => serviceLabels[s] || s).join(", ");

    const prompt = `You are a marketing copywriter for Jaro.dev, a premium software development agency that builds MVPs for startups and companies. Write in Alex Hormozi's style - direct, confident, achievement-focused, and effective at sales. No fluff, just results.

Generate a case study in the EXACT markdown format below. Replace placeholders with relevant content based on the provided information. Be specific, detailed, and impressive. Make it sound like we delivered exceptional value.

PROJECT INFORMATION:
- Project Name: ${data.name}
- Company: ${data.companyName || "Client"}
- Description: ${data.body}
- Technologies Used: ${techList}
- Services Provided: ${serviceList}
- Live URL: ${data.publicUrl || "N/A"}

REQUIRED OUTPUT FORMAT (use this EXACT structure with markdown):

# ${data.name}
## [Generate a compelling tagline about the project]
### [Generate a powerful subtitle about the impact]

**SERVICES**
${data.services.map(s => `- ${serviceLabels[s] || s}`).join("\n")}

**DELIVERABLES**
[List 3-5 key deliverables based on the services and description - be specific]

**LINKS**
${data.publicUrl ? `[${data.publicUrl.replace("https://", "").replace("http://", "")}](${data.publicUrl})` : "[Coming Soon]"}

---

## What we delivered

[Write a brief intro paragraph about the timeline and scope, e.g. "Created a SaaS MVP in X weeks including:"]

### Frontend UI/UX
[Generate 4-6 detailed bullet points about frontend work based on the technologies and description. Each bullet should have a **bold title** followed by a colon and detailed description. Focus on: responsive design, navigation, landing pages, animations, dashboard UX, etc.]

### Backend & Infrastructure
[Generate 4-6 detailed bullet points about backend work. Each bullet should have a **bold title** followed by a colon and detailed description. Focus on: scalable infrastructure, databases, DevOps, CI/CD, API design, security, etc.]

### Authentication & User Flows
[Generate 2-3 detailed bullet points about auth. Each bullet should have a **bold title** followed by a colon and detailed description. Focus on: OAuth, JWT, 2FA, user management, etc.]

### User Dashboard & Features
[Generate 4-6 detailed bullet points about core features. Each bullet should have a **bold title** followed by a colon and detailed description. Make these specific to the project description.]

${data.technologies.some(t => ["CHATGPT", "CLAUDE"].includes(t)) || data.services.includes("AI_INTEGRATION") ? `### Deep AI Integration
[Generate 2-3 detailed bullet points about AI features. Each bullet should have a **bold title** followed by a colon and detailed description. Focus on: generative AI, context-awareness, natural language processing, etc.]` : ""}

${data.services.includes("SAAS") ? `### Billing & Payments
[Generate 2 detailed bullet points about payments. Each bullet should have a **bold title** followed by a colon and detailed description. Focus on: Stripe integration, subscriptions, etc.]` : ""}

### DevOps, Monitoring & Reliability
[Generate 3 detailed bullet points about DevOps. Each bullet should have a **bold title** followed by a colon and detailed description. Focus on: deployments, infrastructure-as-code, scalability, monitoring, etc.]

---

## How we did it
${data.technologies.map(t => technologyLabels[t] || t).join("\n\n")}

---

Remember:
- Be specific and impressive
- Use power words and confident language
- Focus on results and value delivered
- Make it sound like a premium agency delivered this
- No generic filler - every sentence should add value
- Use Alex Hormozi's direct, results-focused copywriting style`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert marketing copywriter who writes compelling case studies for a premium software development agency. Your writing style is direct, confident, and focused on showcasing impressive achievements and results. You follow the Alex Hormozi style of copywriting - no fluff, just value and results."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      return { data: null, error: `OpenAI API error: ${errorData.error?.message || "Unknown error"}` };
    }

    const result = await response.json();
    const generatedText = result.choices[0]?.message?.content;

    if (!generatedText) {
      return { data: null, error: "No content generated" };
    }

    return { data: generatedText, error: null };
  } catch (error) {
    console.error("Error generating case study text:", error);
    return { data: null, error: "Failed to generate case study text" };
  }
}

export async function saveCaseStudyGeneratedText(id: string, generatedText: string) {
  try {
    const caseStudy = await prisma.caseStudy.update({
      where: { id },
      data: { generatedText },
    });

    revalidatePath(`/dashboard/case-studies/${id}`);
    return { data: caseStudy, error: null };
  } catch (error) {
    console.error("Error saving generated text:", error);
    return { data: null, error: "Failed to save generated text" };
  }
}

// Form Submission actions
export async function deleteFormSubmission(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    await prisma.embedFormSubmission.delete({
      where: { id },
    });

    revalidatePath("/dashboard/submissions");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting form submission:", error);
    return { data: null, error: "Failed to delete form submission" };
  }
}

// Generate Facebook Ad Copy using OpenAI with Alex Hormozi style
export async function generateFacebookAdCopy(adData: {
  persona: string;
  need: string;
  painPoints: string[];
  offer: string;
  risks: string[];
  caseStudies: { name: string; body?: string }[];
  cta: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const caseStudyContext = adData.caseStudies
      .map((cs) => `- ${cs.name}${cs.body ? `: ${cs.body.substring(0, 500)}...` : ""}`)
      .join("\n");

    const prompt = `You are Alex Hormozi, the master of direct-response copywriting. Write Facebook ad copy for a software development agency called Jaro.dev that builds MVPs for startups and companies.

Your style:
- Direct, punchy, no fluff
- Pattern interrupts and hooks that stop the scroll
- Speaks directly to pain points
- Uses specific numbers and results when possible
- Creates urgency without being sleazy
- Calls out the avatar directly
- Short sentences. Punchy paragraphs.
- Uses "..." and line breaks for emphasis

TARGET AUDIENCE:
${adData.persona}

WHAT THEY WANT:
${adData.need}

THEIR PAIN POINTS:
${adData.painPoints.map((pp) => `- ${pp}`).join("\n")}

THE OFFER:
Hire Jaro.dev to ${adData.offer}${adData.risks.length > 0 ? ` without ${adData.risks.join(", ")}` : ""}

SOCIAL PROOF (Case Studies):
${caseStudyContext}

CTA:
${adData.cta}

Generate the following Facebook ad components in JSON format:

{
  "primaryText": "The main ad copy that appears above the image/video. Should be 3-5 short paragraphs with hooks, pain agitation, solution, proof, and CTA. Use line breaks between paragraphs. Make it punchy and direct. Around 100-150 words.",
  "headline": "Short, punchy headline under 40 characters that grabs attention. Should create curiosity or call out the avatar.",
  "description": "Secondary text under headline, around 20-30 words. Reinforce the main benefit or add urgency.",
  "imageAdText": "Text overlay for image ad. Maximum 20 words. Should be a bold statement or question that stops the scroll.",
  "videoScript": "30-60 second video script with HOOK (first 3 seconds), PROBLEM (agitate pain), SOLUTION (your offer), PROOF (case study mention), CTA (what to do next). Format as: [HOOK] text [PROBLEM] text [SOLUTION] text [PROOF] text [CTA] text"
}

Return ONLY valid JSON, no markdown code blocks or other text.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content:
              "You are Alex Hormozi, a world-class direct-response copywriter. You write copy that converts. You're direct, punchy, and always lead with value. You never use corporate jargon or fluff. Every word earns its place. Return only valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      return {
        data: null,
        error: `OpenAI API error: ${errorData.error?.message || "Unknown error"}`,
      };
    }

    const result = await response.json();
    const generatedContent = result.choices[0]?.message?.content;

    if (!generatedContent) {
      return { data: null, error: "No content generated" };
    }

    // Parse the JSON response
    try {
      const adCopy = JSON.parse(generatedContent);
      return { data: adCopy, error: null };
    } catch {
      console.error("Failed to parse AI response:", generatedContent);
      return { data: null, error: "Failed to parse generated content" };
    }
  } catch (error) {
    console.error("Error generating Facebook ad copy:", error);
    return { data: null, error: "Failed to generate Facebook ad copy" };
  }
}

// User actions
export async function createUser(data: { email: string; role: UserRole; clientCompanyId?: string }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can create users" };
    }

    // CLIENT role users must be linked to a client company
    if (data.role === "CLIENT" && !data.clientCompanyId) {
      return { data: null, error: "Client users must be linked to a client company" };
    }

    // Non-CLIENT role users cannot be linked to a client company
    if (data.role !== "CLIENT" && data.clientCompanyId) {
      return { data: null, error: "Only client users can be linked to a client company" };
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return { data: null, error: "User with this email already exists" };
    }

    // Verify client company exists if provided
    if (data.clientCompanyId) {
      const clientCompany = await prisma.company.findUnique({
        where: { id: data.clientCompanyId },
      });
      if (!clientCompany) {
        return { data: null, error: "Client company not found" };
      }
    }

    // Generate auto password using cuid
    const autoPassword = createId();
    const hashedPassword = await bcrypt.hash(autoPassword, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: data.role,
        clientCompanyId: data.clientCompanyId,
      },
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
    });

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/clients");
    return { data: { user, generatedPassword: autoPassword }, error: null };
  } catch (error) {
    console.error("Error creating user:", error);
    return { data: null, error: "Failed to create user" };
  }
}

export async function updateUserRole(userId: string, role: UserRole, clientCompanyId?: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can update user roles" };
    }

    // Prevent admin from changing their own role
    if (currentUser.id === userId) {
      return { data: null, error: "You cannot change your own role" };
    }

    // CLIENT role must have clientCompanyId
    if (role === "CLIENT" && !clientCompanyId) {
      return { data: null, error: "Client users must be linked to a client company" };
    }

    // Non-CLIENT roles cannot have clientCompanyId
    const updateData: { role: UserRole; clientCompanyId: string | null } = {
      role,
      clientCompanyId: role === "CLIENT" ? clientCompanyId! : null,
    };

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
    });

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/clients");
    return { data: user, error: null };
  } catch (error) {
    console.error("Error updating user role:", error);
    return { data: null, error: "Failed to update user role" };
  }
}

export async function deleteUser(userId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can delete users" };
    }

    // Prevent admin from deleting themselves
    if (currentUser.id === userId) {
      return { data: null, error: "You cannot delete your own account" };
    }

    // Prevent deleting protected user
    if (userId === "cm36gmb6g0000n2asjjc1cvk4") {
      return { data: null, error: "This user cannot be deleted" };
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    revalidatePath("/dashboard/users");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { data: null, error: "Failed to delete user" };
  }
}

export async function resetUserPassword(userId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can reset passwords" };
    }

    // Generate new password using cuid
    const newPassword = createId();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    revalidatePath("/dashboard/users");
    return { data: { newPassword }, error: null };
  } catch (error) {
    console.error("Error resetting user password:", error);
    return { data: null, error: "Failed to reset user password" };
  }
}

export async function getImpersonationPassword() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can impersonate users" };
    }

    const adminPass = process.env.ADMIN_PASS;
    if (!adminPass) {
      return { data: null, error: "ADMIN_PASS not configured" };
    }

    return { data: { password: adminPass }, error: null };
  } catch (error) {
    console.error("Error getting impersonation password:", error);
    return { data: null, error: "Failed to get impersonation password" };
  }
}

// Task actions
export async function createTask(data: {
  id?: string;
  name: string;
  description?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "PENDING_ADMIN_REVIEW" | "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  dueDate?: Date;
  clientCompanyId: string;
  assigneeId?: string;
  blockedByTaskIds?: string[];
  blockedByActionItemIds?: string[];
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin or developer
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DEVELOPER")) {
      return { data: null, error: "Only admins and developers can create tasks" };
    }

    const task = await prisma.task.create({
      data: {
        ...(data.id && { id: data.id }),
        name: data.name,
        description: data.description,
        priority: data.priority,
        status: data.status,
        dueDate: data.dueDate,
        clientCompanyId: data.clientCompanyId,
        assigneeId: data.assigneeId,
        ...(data.blockedByTaskIds && data.blockedByTaskIds.length > 0 && {
          blockedByTasks: {
            connect: data.blockedByTaskIds.map((id) => ({ id })),
          },
        }),
        ...(data.blockedByActionItemIds && data.blockedByActionItemIds.length > 0 && {
          blockedByActionItems: {
            connect: data.blockedByActionItemIds.map((id) => ({ id })),
          },
        }),
        ...(data.attachments && data.attachments.length > 0 && {
          attachments: {
            create: data.attachments.map((att) => ({
              name: att.name,
              url: att.url,
              type: att.type,
              size: att.size,
            })),
          },
        }),
      },
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
      },
    });

    revalidatePath("/dashboard/tasks");
    return { data: task, error: null };
  } catch (error) {
    console.error("Error creating task:", error);
    return { data: null, error: "Failed to create task" };
  }
}

export async function updateTask(
  id: string,
  data: {
    name?: string;
    description?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    status?: "PENDING_ADMIN_REVIEW" | "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
    dueDate?: Date | null;
    clientCompanyId?: string;
    assigneeId?: string | null;
    blockedByTaskIds?: string[];
    blockedByActionItemIds?: string[];
    newAttachments?: Array<{
      name: string;
      url: string;
      type: string;
      size: number;
    }>;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin or developer
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DEVELOPER")) {
      return { data: null, error: "Only admins and developers can update tasks" };
    }

    // Get existing task to check for status change
    const existingTask = await prisma.task.findUnique({
      where: { id },
      select: { status: true, clientCompanyId: true },
    });

    // Create new attachments if any
    if (data.newAttachments && data.newAttachments.length > 0) {
      await prisma.attachment.createMany({
        data: data.newAttachments.map((att) => ({
          name: att.name,
          url: att.url,
          type: att.type,
          size: att.size,
          taskId: id,
        })),
      });
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.clientCompanyId !== undefined && { clientCompanyId: data.clientCompanyId }),
        ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
        ...(data.blockedByTaskIds !== undefined && {
          blockedByTasks: {
            set: data.blockedByTaskIds.map((taskId) => ({ id: taskId })),
          },
        }),
        ...(data.blockedByActionItemIds !== undefined && {
          blockedByActionItems: {
            set: data.blockedByActionItemIds.map((actionItemId) => ({ id: actionItemId })),
          },
        }),
      },
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
      },
    });

    // Send notifications if task was just completed
    if (data.status === "DONE" && existingTask?.status !== "DONE") {
      notifyTaskCompleted(task.clientCompanyId, task.id, task.name, task.assignee?.email);
      // Unblock and notify any tasks that were blocked by this task. Awaited so the
      // unblocked task statuses are persisted before we revalidate the page.
      await checkAndNotifyUnblockedTasks(id, "task");
    }

    revalidatePath("/dashboard/tasks");
    return { data: task, error: null };
  } catch (error) {
    console.error("Error updating task:", error);
    return { data: null, error: "Failed to update task" };
  }
}

export async function deleteAttachment(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DEVELOPER")) {
      return { data: null, error: "Only admins and developers can delete attachments" };
    }

    // Get the attachment to retrieve the URL before deleting
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return { data: null, error: "Attachment not found" };
    }

    // Delete from database
    await prisma.attachment.delete({
      where: { id },
    });

    // Delete from Vercel Blob storage
    try {
      await del(attachment.url);
    } catch (blobError) {
      // Log but don't fail the request if blob deletion fails
      console.error("Error deleting from blob storage:", blobError);
    }

    revalidatePath("/dashboard/tasks");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return { data: null, error: "Failed to delete attachment" };
  }
}

export async function deleteTask(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Allow admins and developers to delete tasks (devs need this for stale automation-created tasks)
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DEVELOPER")) {
      return { data: null, error: "Only admins and developers can delete tasks" };
    }

    await prisma.task.delete({
      where: { id },
    });

    revalidatePath("/dashboard/tasks");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting task:", error);
    return { data: null, error: "Failed to delete task" };
  }
}

// ============================================
// ACTION ITEM ACTIONS
// ============================================

export async function createActionItem(data: {
  id?: string;
  name: string;
  description?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "PENDING_ADMIN_REVIEW" | "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  clientCompanyId: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin or developer
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DEVELOPER")) {
      return { data: null, error: "Only admins and developers can create action items" };
    }

    // Developers always create with PENDING_ADMIN_REVIEW status
    const finalStatus = currentUser.role === "DEVELOPER" ? "PENDING_ADMIN_REVIEW" : data.status;

    const actionItem = await prisma.actionItem.create({
      data: {
        ...(data.id && { id: data.id }),
        name: data.name,
        description: data.description,
        priority: data.priority,
        status: finalStatus,
        clientCompanyId: data.clientCompanyId,
        createdById: currentUser.id,
      },
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Send Slack notification (only for non-pending items created by admins)
    if (currentUser.role === "ADMIN") {
      notifyActionItemCreated(data.clientCompanyId, actionItem.id, data.name, data.priority);
    }

    revalidatePath("/dashboard/action-items");
    return { data: actionItem, error: null };
  } catch (error) {
    console.error("Error creating action item:", error);
    return { data: null, error: "Failed to create action item" };
  }
}

export async function updateActionItem(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    status?: "PENDING_ADMIN_REVIEW" | "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
    clientCompanyId?: string;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin or developer
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DEVELOPER")) {
      return { data: null, error: "Only admins and developers can update action items" };
    }

    // Get existing action item to check for status change and permissions
    const existingItem = await prisma.actionItem.findUnique({
      where: { id },
      select: { status: true, name: true, clientCompanyId: true },
    });

    if (!existingItem) {
      return { data: null, error: "Action item not found" };
    }

    // Admins and developers can update items in any status, including moving them out of
    // PENDING_ADMIN_REVIEW.
    const actionItem = await prisma.actionItem.update({
      where: { id },
      data,
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Send notifications if action item was just completed
    if (data.status === "DONE" && existingItem?.status !== "DONE") {
      notifyActionItemCompleted(actionItem.clientCompanyId, actionItem.id, actionItem.name);
      // Unblock and notify any tasks that were blocked by this action item. Awaited so the
      // unblocked task statuses are persisted before we revalidate the page.
      await checkAndNotifyUnblockedTasks(id, "actionItem");
    }

    revalidatePath("/dashboard/action-items");
    revalidatePath("/dashboard/tasks");
    return { data: actionItem, error: null };
  } catch (error) {
    console.error("Error updating action item:", error);
    return { data: null, error: "Failed to update action item" };
  }
}

export async function deleteActionItem(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Allow admins and developers to delete action items (devs need this for stale automation-created items)
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DEVELOPER")) {
      return { data: null, error: "Only admins and developers can delete action items" };
    }

    await prisma.actionItem.delete({
      where: { id },
    });

    revalidatePath("/dashboard/action-items");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting action item:", error);
    return { data: null, error: "Failed to delete action item" };
  }
}

// Client action to update action item status only
export async function updateActionItemStatus(
  id: string,
  status: "PENDING_ADMIN_REVIEW" | "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE"
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return { data: null, error: "User not found" };
    }

    // Get the action item to verify ownership and check for status change
    const existingItem = await prisma.actionItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return { data: null, error: "Action item not found" };
    }

    // Clients can only update status of their own company's action items
    if (currentUser.role === "CLIENT" && currentUser.clientCompanyId !== existingItem.clientCompanyId) {
      return { data: null, error: "You can only update your own company's action items" };
    }

    const actionItem = await prisma.actionItem.update({
      where: { id },
      data: { status },
      include: {
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Send notifications if action item was just completed
    if (status === "DONE" && existingItem.status !== "DONE") {
      notifyActionItemCompleted(actionItem.clientCompanyId, actionItem.id, actionItem.name);
      // Unblock and notify any tasks that were blocked by this action item. Awaited so the
      // unblocked task statuses are persisted before we revalidate the page.
      await checkAndNotifyUnblockedTasks(id, "actionItem");
    }

    revalidatePath("/dashboard/client-action-items");
    revalidatePath("/dashboard/action-items");
    revalidatePath("/dashboard/tasks");
    return { data: actionItem, error: null };
  } catch (error) {
    console.error("Error updating action item status:", error);
    return { data: null, error: "Failed to update action item status" };
  }
}

// ============================================
// REQUEST ACTIONS
// ============================================

export async function createRequest(data: {
  title: string;
  description?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  type: "FEATURE" | "BUG";
  clientCompanyId: string;
  // Bug-specific fields
  stepsToReproduce?: string;
  expectedBehavior?: string;
  bugSeverity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  screenRecordingUrl?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return { data: null, error: "User not found" };
    }

    // Only clients can create requests
    if (currentUser.role !== "CLIENT") {
      return { data: null, error: "Only clients can create requests" };
    }

    // Verify the client belongs to this company OR it's the Jaro.dev Internal company (studio bug reports)
    if (currentUser.clientCompanyId !== data.clientCompanyId && data.clientCompanyId !== JARO_DEV_INTERNAL_CLIENT_ID) {
      return { data: null, error: "You can only create requests for your own company" };
    }

    const request = await prisma.request.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        type: data.type,
        status: "SUBMITTED",
        clientCompanyId: data.clientCompanyId,
        createdById: currentUser.id,
        // Bug-specific fields (only populated for BUG type)
        ...(data.type === "BUG" && {
          stepsToReproduce: data.stepsToReproduce,
          expectedBehavior: data.expectedBehavior,
          bugSeverity: data.bugSeverity,
          screenRecordingUrl: data.screenRecordingUrl,
        }),
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
    });

    // Send Slack notification
    if (data.type === "FEATURE") {
      notifyFeatureRequested(data.clientCompanyId, request.id, data.title, data.priority);
    } else {
      notifyBugRequested(data.clientCompanyId, request.id, data.title, data.bugSeverity);
    }

    revalidatePath("/dashboard/feature-requests");
    revalidatePath("/dashboard/bug-requests");
    revalidatePath("/dashboard/studio-bug-report");
    return { data: request, error: null };
  } catch (error) {
    console.error("Error creating request:", error);
    return { data: null, error: "Failed to create request" };
  }
}

export async function updateRequest(
  id: string,
  data: {
    title?: string;
    description?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    // Bug-specific fields
    stepsToReproduce?: string;
    expectedBehavior?: string;
    bugSeverity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    screenRecordingUrl?: string;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return { data: null, error: "User not found" };
    }

    // Get the existing request
    const existingRequest = await prisma.request.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return { data: null, error: "Request not found" };
    }

    // Only allow editing if status is SUBMITTED
    if (existingRequest.status !== "SUBMITTED") {
      return { data: null, error: "Can only edit requests with status 'Submitted'" };
    }

    // Clients can only edit their own company's requests
    if (currentUser.role === "CLIENT" && currentUser.clientCompanyId !== existingRequest.clientCompanyId) {
      return { data: null, error: "You can only edit your own company's requests" };
    }

    const request = await prisma.request.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.priority !== undefined && { priority: data.priority }),
        // Bug-specific fields
        ...(data.stepsToReproduce !== undefined && { stepsToReproduce: data.stepsToReproduce }),
        ...(data.expectedBehavior !== undefined && { expectedBehavior: data.expectedBehavior }),
        ...(data.bugSeverity !== undefined && { bugSeverity: data.bugSeverity }),
        ...(data.screenRecordingUrl !== undefined && { screenRecordingUrl: data.screenRecordingUrl }),
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
    });

    revalidatePath("/dashboard/feature-requests");
    revalidatePath("/dashboard/bug-requests");
    return { data: request, error: null };
  } catch (error) {
    console.error("Error updating request:", error);
    return { data: null, error: "Failed to update request" };
  }
}

export async function deleteRequest(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return { data: null, error: "User not found" };
    }

    // Get the existing request
    const existingRequest = await prisma.request.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return { data: null, error: "Request not found" };
    }

    // Clients can only delete their own company's requests with SUBMITTED status
    if (currentUser.role === "CLIENT") {
      if (existingRequest.status !== "SUBMITTED") {
        return { data: null, error: "Can only delete requests with status 'Submitted'" };
      }
      if (currentUser.clientCompanyId !== existingRequest.clientCompanyId) {
        return { data: null, error: "You can only delete your own company's requests" };
      }
    }

    await prisma.request.delete({
      where: { id },
    });

    revalidatePath("/dashboard/feature-requests");
    revalidatePath("/dashboard/bug-requests");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting request:", error);
    return { data: null, error: "Failed to delete request" };
  }
}

export async function rejectRequest(id: string, rejectionComment: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DEVELOPER")) {
      return { data: null, error: "Only admins and developers can reject requests" };
    }

    if (!rejectionComment || rejectionComment.trim() === "") {
      return { data: null, error: "Rejection comment is required" };
    }

    const existingRequest = await prisma.request.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return { data: null, error: "Request not found" };
    }

    if (existingRequest.status !== "SUBMITTED") {
      return { data: null, error: "Can only reject requests with status 'Submitted'" };
    }

    const request = await prisma.request.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionComment: rejectionComment.trim(),
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
    });

    revalidatePath("/dashboard/feature-requests");
    revalidatePath("/dashboard/bug-requests");
    return { data: request, error: null };
  } catch (error) {
    console.error("Error rejecting request:", error);
    return { data: null, error: "Failed to reject request" };
  }
}

// ============================================
// USER PROFILE ACTIONS
// ============================================

export async function updateUserProfile(data: {
  firstName?: string;
  lastName?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName || null }),
        ...(data.lastName !== undefined && { lastName: data.lastName || null }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
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
    });

    // Note: Not using revalidatePath here to avoid refresh loops
    // The sidebar will update on next navigation
    return { data: user, error: null };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return { data: null, error: "Failed to update profile" };
  }
}

export async function updateUserPassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Validate new password
    if (!data.newPassword || data.newPassword.length < 8) {
      return { data: null, error: "New password must be at least 8 characters" };
    }

    // Get user with current password
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValidPassword) {
      return { data: null, error: "Current password is incorrect" };
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(data.newPassword, 10);
    await prisma.user.update({
      where: { email: session.user.email },
      data: { password: hashedPassword },
    });

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Error updating user password:", error);
    return { data: null, error: "Failed to update password" };
  }
}

// ============================================
// TASK VIEWS (Saved Filters)
// ============================================

export interface TaskViewData {
  id: string;
  name: string;
  viewMode: string;
  sortColumn: string | null;
  sortDirection: string;
  statusFilters: string[];
  priorityFilters: string[];
  clientFilters: string[];
  assigneeFilters: string[];
  createdByFilters: string[];
  agentExecutionFilters: string[];
  createdAt: Date;
  updatedAt: Date;
}

export async function getTaskViews(): Promise<{
  data: TaskViewData[] | null;
  error: string | null;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    const taskViews = await prisma.taskView.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });

    return { data: taskViews, error: null };
  } catch (error) {
    console.error("Error fetching task views:", error);
    return { data: null, error: "Failed to fetch task views" };
  }
}

export async function createTaskView(data: {
  name: string;
  viewMode: string;
  sortColumn: string | null;
  sortDirection: string;
  statusFilters: string[];
  priorityFilters: string[];
  clientFilters: string[];
  assigneeFilters: string[];
  createdByFilters: string[];
  agentExecutionFilters: string[];
}): Promise<{ data: TaskViewData | null; error: string | null }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    // Check for duplicate name
    const existing = await prisma.taskView.findFirst({
      where: {
        userId: user.id,
        name: data.name,
      },
    });

    if (existing) {
      return { data: null, error: "A view with this name already exists" };
    }

    const taskView = await prisma.taskView.create({
      data: {
        name: data.name,
        viewMode: data.viewMode,
        sortColumn: data.sortColumn,
        sortDirection: data.sortDirection,
        statusFilters: data.statusFilters,
        priorityFilters: data.priorityFilters,
        clientFilters: data.clientFilters,
        assigneeFilters: data.assigneeFilters,
        createdByFilters: data.createdByFilters,
        agentExecutionFilters: data.agentExecutionFilters,
        userId: user.id,
      },
    });

    revalidatePath("/dashboard/tasks");
    return { data: taskView, error: null };
  } catch (error) {
    console.error("Error creating task view:", error);
    return { data: null, error: "Failed to create task view" };
  }
}

export async function updateTaskView(
  id: string,
  data: {
    name?: string;
  }
): Promise<{ data: TaskViewData | null; error: string | null }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    // Verify ownership
    const existing = await prisma.taskView.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existing) {
      return { data: null, error: "Task view not found" };
    }

    // Check for duplicate name if renaming
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.taskView.findFirst({
        where: {
          userId: user.id,
          name: data.name,
          NOT: { id },
        },
      });

      if (duplicate) {
        return { data: null, error: "A view with this name already exists" };
      }
    }

    const taskView = await prisma.taskView.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
      },
    });

    revalidatePath("/dashboard/tasks");
    return { data: taskView, error: null };
  } catch (error) {
    console.error("Error updating task view:", error);
    return { data: null, error: "Failed to update task view" };
  }
}

export async function deleteTaskView(id: string): Promise<{
  data: boolean | null;
  error: string | null;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    // Verify ownership
    const existing = await prisma.taskView.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existing) {
      return { data: null, error: "Task view not found" };
    }

    await prisma.taskView.delete({
      where: { id },
    });

    revalidatePath("/dashboard/tasks");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting task view:", error);
    return { data: null, error: "Failed to delete task view" };
  }
}

// ============================================
// TASK AGENT EXECUTION
// ============================================

const GITHUB_ORG_FOR_TASKS = process.env.GITHUB_ORG || "Jaro-dev-studio";

export interface TaskAgentExecutionData {
  id: string;
  taskId: string;
  githubRepoName: string;
  githubRepoUrl: string;
  prompt: string;
  cursorAgentId: string;
  cursorAgentUrl: string;
  cursorAgentStatus: string;
  prUrl: string | null;
  prNumber: number | null;
  branchName: string | null;
  summary: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Execute a task with a Cursor Cloud Agent
 * Creates a PR with the changes
 */
export async function executeTaskWithAgent(
  taskId: string,
  repoName: string,
  additionalPrompt?: string
): Promise<{
  data: TaskAgentExecutionData | null;
  error: string | null;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "DEVELOPER")) {
      return { data: null, error: "Not authorized" };
    }

    // Get the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        clientCompany: true,
      },
    });

    if (!task) {
      return { data: null, error: "Task not found" };
    }

    // Build the prompt
    const prompt = buildTaskAgentPrompt(task.name, task.description, additionalPrompt);

    // Build repo URL
    const repoUrl = `https://github.com/${GITHUB_ORG_FOR_TASKS}/${repoName}`;

    console.log(`[executeTaskWithAgent] Executing task "${task.name}" with agent`);
    console.log(`[executeTaskWithAgent] Repo: ${repoUrl}`);

    // Launch the Cursor agent with autoCreatePr: true
    const { data: cursorData, error: cursorError } = await launchCursorAgent(
      repoUrl,
      prompt,
      { autoCreatePr: true }
    );

    if (cursorError || !cursorData) {
      console.error("[executeTaskWithAgent] Failed to launch agent:", cursorError);
      return { data: null, error: cursorError || "Failed to launch Cursor agent" };
    }

    // Create the TaskAgentExecution record
    const execution = await prisma.taskAgentExecution.create({
      data: {
        taskId,
        githubRepoName: repoName,
        githubRepoUrl: repoUrl,
        prompt,
        cursorAgentId: cursorData.agentId,
        cursorAgentUrl: cursorData.agentUrl,
        cursorAgentStatus: cursorData.agentStatus,
      },
    });

    // Update task status to IN_PROGRESS
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "IN_PROGRESS" },
    });

    console.log(`[executeTaskWithAgent] Created execution: ${execution.id}`);
    console.log(`[executeTaskWithAgent] Agent ID: ${cursorData.agentId}`);
    console.log(`[executeTaskWithAgent] Agent URL: ${cursorData.agentUrl}`);

    revalidatePath("/dashboard/tasks");

    return { data: execution, error: null };
  } catch (error) {
    console.error("[executeTaskWithAgent] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to execute task with agent",
    };
  }
}

/**
 * Build the prompt for the Cursor agent to work on a task
 */
function buildTaskAgentPrompt(
  taskName: string,
  taskDescription: string | null,
  additionalPrompt?: string
): string {
  return `## Task: ${taskName}

${taskDescription || "No description provided."}

${additionalPrompt ? `## Additional Instructions\n${additionalPrompt}\n` : ""}
## Requirements
- Create a PR with your changes
- Follow the existing code style and conventions
- Include appropriate tests if applicable
- Write clear commit messages

## CRITICAL: Build Verification
At the end of the task, you MUST:
1. Run the build command (pnpm build or npm run build)
2. Fix ALL build errors before completing the task
3. Ensure the project compiles successfully with zero errors
4. If using third party APIs, test the GET requests to make sure the data being sent is valid and it returns a 200`;
}

/**
 * Sync a task agent execution status (for manual refresh)
 */
export async function syncTaskAgentExecutionStatus(
  executionId: string
): Promise<{
  data: TaskAgentExecutionData | null;
  error: string | null;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "DEVELOPER")) {
      return { data: null, error: "Not authorized" };
    }

    const execution = await prisma.taskAgentExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      return { data: null, error: "Execution not found" };
    }

    // Check agent status
    const { data: agentStatus, error: agentError } = await checkCursorAgentStatus(
      execution.cursorAgentId
    );

    if (agentError || !agentStatus) {
      return { data: null, error: agentError || "Failed to check agent status" };
    }

    // Update the execution record
    const updatedExecution = await prisma.taskAgentExecution.update({
      where: { id: executionId },
      data: {
        cursorAgentStatus: agentStatus.status,
        prUrl: agentStatus.prUrl || execution.prUrl,
        branchName: agentStatus.branchName || execution.branchName,
        summary: agentStatus.summary || execution.summary,
      },
    });

    revalidatePath("/dashboard/tasks");

    return { data: updatedExecution, error: null };
  } catch (error) {
    console.error("[syncTaskAgentExecutionStatus] Error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to sync execution status",
    };
  }
}

// ============================================
// ACTION ITEM VIEW ACTIONS
// ============================================

export interface ActionItemViewData {
  id: string;
  name: string;
  viewMode: string;
  sortColumn: string | null;
  sortDirection: string;
  statusFilters: string[];
  priorityFilters: string[];
  clientFilters: string[];
  createdAt: Date;
  updatedAt: Date;
}

export async function getActionItemViews(): Promise<{
  data: ActionItemViewData[] | null;
  error: string | null;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    const actionItemViews = await prisma.actionItemView.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });

    return { data: actionItemViews, error: null };
  } catch (error) {
    console.error("Error fetching action item views:", error);
    return { data: null, error: "Failed to fetch action item views" };
  }
}

export async function createActionItemView(data: {
  name: string;
  viewMode: string;
  sortColumn: string | null;
  sortDirection: string;
  statusFilters: string[];
  priorityFilters: string[];
  clientFilters: string[];
}): Promise<{ data: ActionItemViewData | null; error: string | null }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    // Check for duplicate name
    const existing = await prisma.actionItemView.findFirst({
      where: {
        userId: user.id,
        name: data.name,
      },
    });

    if (existing) {
      return { data: null, error: "A view with this name already exists" };
    }

    const actionItemView = await prisma.actionItemView.create({
      data: {
        name: data.name,
        viewMode: data.viewMode,
        sortColumn: data.sortColumn,
        sortDirection: data.sortDirection,
        statusFilters: data.statusFilters,
        priorityFilters: data.priorityFilters,
        clientFilters: data.clientFilters,
        userId: user.id,
      },
    });

    revalidatePath("/dashboard/action-items");
    return { data: actionItemView, error: null };
  } catch (error) {
    console.error("Error creating action item view:", error);
    return { data: null, error: "Failed to create action item view" };
  }
}

export async function updateActionItemView(
  id: string,
  data: {
    name?: string;
  }
): Promise<{ data: ActionItemViewData | null; error: string | null }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    // Verify ownership
    const existing = await prisma.actionItemView.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existing) {
      return { data: null, error: "Action item view not found" };
    }

    // Check for duplicate name if renaming
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.actionItemView.findFirst({
        where: {
          userId: user.id,
          name: data.name,
          NOT: { id },
        },
      });

      if (duplicate) {
        return { data: null, error: "A view with this name already exists" };
      }
    }

    const actionItemView = await prisma.actionItemView.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
      },
    });

    revalidatePath("/dashboard/action-items");
    return { data: actionItemView, error: null };
  } catch (error) {
    console.error("Error updating action item view:", error);
    return { data: null, error: "Failed to update action item view" };
  }
}

export async function deleteActionItemView(id: string): Promise<{
  data: boolean | null;
  error: string | null;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    // Verify ownership
    const existing = await prisma.actionItemView.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existing) {
      return { data: null, error: "Action item view not found" };
    }

    await prisma.actionItemView.delete({
      where: { id },
    });

    revalidatePath("/dashboard/action-items");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting action item view:", error);
    return { data: null, error: "Failed to delete action item view" };
  }
}

// ============================================
// COMMAND PALETTE SEARCH
// ============================================

export type CommandPaletteResultType =
  | "task"
  | "action-item"
  | "request"
  | "client"
  | "person"
  | "deal"
  | "sequence"
  | "meeting"
  | "case-study"
  | "offer"
  | "submission"
  | "user"
  | "workflow"
  | "sales-call-map"
  | "mvp-call-map"
  | "demo"
  | "presentation"
  | "calculation"
  | "gov-contract"
  | "knowledge-base";

export interface CommandPaletteResult {
  id: string;
  name: string;
  type: CommandPaletteResultType;
  subtitle?: string;
  href: string;
}

// Each entity gets a small slice so no single type crowds out the rest. Results
// are interleaved afterwards, so the cap is a display limit rather than a budget.
const COMMAND_PALETTE_TAKE_PER_TYPE = 3;
const COMMAND_PALETTE_MAX_RESULTS = 24;

type CommandPaletteSearcher = (term: string) => Promise<CommandPaletteResult[]>;

// Searchers available to developers. These map onto the only pages a developer
// can actually open, so results never navigate them into a redirect.
const developerSearchers: CommandPaletteSearcher[] = [
  async (term) => {
    const tasks = await prisma.task.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      select: { id: true, name: true, clientCompany: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return tasks.map((t) => ({
      id: t.id,
      name: t.name,
      type: "task" as const,
      subtitle: t.clientCompany?.name,
      href: `/dashboard/tasks?highlight=${t.id}`,
    }));
  },
  async (term) => {
    const actionItems = await prisma.actionItem.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      select: { id: true, name: true, clientCompany: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return actionItems.map((a) => ({
      id: a.id,
      name: a.name,
      type: "action-item" as const,
      subtitle: a.clientCompany?.name,
      href: `/dashboard/action-items?highlight=${a.id}`,
    }));
  },
  async (term) => {
    const requests = await prisma.request.findMany({
      where: { title: { contains: term, mode: "insensitive" } },
      select: { id: true, title: true, type: true, clientCompany: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return requests.map((r) => ({
      id: r.id,
      name: r.title,
      type: "request" as const,
      subtitle: [r.type === "FEATURE" ? "Feature" : "Bug", r.clientCompany?.name]
        .filter(Boolean)
        .join(" • "),
      href: r.type === "FEATURE" ? "/dashboard/feature-requests" : "/dashboard/bug-requests",
    }));
  },
];

// Searchers restricted to admins, covering the rest of the dashboard.
const adminSearchers: CommandPaletteSearcher[] = [
  async (term) => {
    const companies = await prisma.company.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { domain: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, industry: true, domain: true },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      type: "client" as const,
      subtitle: c.industry || c.domain || undefined,
      href: `/dashboard/clients/${c.id}`,
    }));
  },
  async (term) => {
    const people = await prisma.person.findMany({
      where: {
        OR: [
          { fullName: { contains: term, mode: "insensitive" } },
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        firstName: true,
        lastName: true,
        email: true,
        jobTitle: true,
        company: { select: { name: true } },
      },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return people.map((p) => ({
      id: p.id,
      name:
        p.fullName ||
        [p.firstName, p.lastName].filter(Boolean).join(" ") ||
        p.email ||
        "Unnamed person",
      type: "person" as const,
      subtitle: [p.jobTitle, p.company?.name].filter(Boolean).join(" • ") || p.email || undefined,
      href: `/dashboard/crm/people/${p.id}`,
    }));
  },
  async (term) => {
    const deals = await prisma.deal.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        company: { select: { name: true } },
        stage: { select: { name: true } },
      },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return deals.map((d) => ({
      id: d.id,
      name: d.name,
      type: "deal" as const,
      subtitle: [d.company?.name, d.stage?.name].filter(Boolean).join(" • ") || undefined,
      href: `/dashboard/crm/deals/${d.id}`,
    }));
  },
  async (term) => {
    const sequences = await prisma.sequence.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      select: { id: true, name: true, status: true },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return sequences.map((s) => ({
      id: s.id,
      name: s.name,
      type: "sequence" as const,
      subtitle: s.status,
      href: `/dashboard/crm/sequences/${s.id}`,
    }));
  },
  async (term) => {
    const meetings = await prisma.meeting.findMany({
      where: { title: { contains: term, mode: "insensitive" } },
      select: { id: true, title: true, startTime: true },
      orderBy: { startTime: "desc" },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return meetings.map((m) => ({
      id: m.id,
      name: m.title,
      type: "meeting" as const,
      subtitle: m.startTime.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      href: "/dashboard/calls",
    }));
  },
  async (term) => {
    const caseStudies = await prisma.caseStudy.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { companyName: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, companyName: true },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return caseStudies.map((cs) => ({
      id: cs.id,
      name: cs.name,
      type: "case-study" as const,
      subtitle: cs.companyName || undefined,
      href: `/dashboard/case-studies/${cs.id}`,
    }));
  },
  async (term) => {
    const offers = await prisma.offer.findMany({
      where: { title: { contains: term, mode: "insensitive" } },
      select: { id: true, title: true },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return offers.map((o) => ({
      id: o.id,
      name: o.title,
      type: "offer" as const,
      href: "/dashboard/offers",
    }));
  },
  async (term) => {
    const submissions = await prisma.embedFormSubmission.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "desc" },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return submissions.map((s) => ({
      id: s.id,
      name: s.name,
      type: "submission" as const,
      subtitle: s.email,
      href: "/dashboard/submissions",
    }));
  },
  async (term) => {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: term, mode: "insensitive" } },
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return users.map((u) => ({
      id: u.id,
      name: u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email,
      type: "user" as const,
      subtitle: u.role,
      href: "/dashboard/users",
    }));
  },
  async (term) => {
    const workflows = await prisma.workflow.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      select: { id: true, name: true, triggerType: true },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return workflows.map((w) => ({
      id: w.id,
      name: w.name,
      type: "workflow" as const,
      subtitle: w.triggerType,
      href: `/dashboard/workflow-maps/${w.id}`,
    }));
  },
  async (term) => {
    const salesCallMaps = await prisma.salesCallMap.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      select: { id: true, name: true, clientCompany: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return salesCallMaps.map((m) => ({
      id: m.id,
      name: m.name,
      type: "sales-call-map" as const,
      subtitle: m.clientCompany?.name,
      href: `/dashboard/sales-call-maps/${m.id}`,
    }));
  },
  async (term) => {
    const mvpCallMaps = await prisma.mVPCallMap.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      select: { id: true, name: true, clientCompany: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return mvpCallMaps.map((m) => ({
      id: m.id,
      name: m.name,
      type: "mvp-call-map" as const,
      subtitle: m.clientCompany?.name,
      href: `/dashboard/mvp-call-maps/${m.id}`,
    }));
  },
  async (term) => {
    const demos = await prisma.demo.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { slug: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, status: true },
      orderBy: { createdAt: "desc" },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return demos.map((d) => ({
      id: d.id,
      name: d.name,
      type: "demo" as const,
      subtitle: d.status,
      href: "/dashboard/demos",
    }));
  },
  async (term) => {
    const presentations = await prisma.presentation.findMany({
      where: { title: { contains: term, mode: "insensitive" } },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return presentations.map((p) => ({
      id: p.id,
      name: p.title,
      type: "presentation" as const,
      href: `/dashboard/presentations/${p.id}`,
    }));
  },
  async (term) => {
    const calculations = await prisma.calculation.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      select: { id: true, name: true, description: true },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return calculations.map((c) => ({
      id: c.id,
      name: c.name,
      type: "calculation" as const,
      subtitle: c.description || undefined,
      href: `/dashboard/calculation/${c.id}`,
    }));
  },
  async (term) => {
    const contracts = await prisma.govContract.findMany({
      where: {
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { solicitationNumber: { contains: term, mode: "insensitive" } },
          { agency: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, agency: true },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return contracts.map((c) => ({
      id: c.id,
      name: c.title,
      type: "gov-contract" as const,
      subtitle: c.agency,
      href: `/dashboard/sam-gov/${c.id}`,
    }));
  },
  async (term) => {
    const documents = await prisma.knowledgeBaseDocument.findMany({
      where: { title: { contains: term, mode: "insensitive" } },
      select: { id: true, title: true, status: true },
      take: COMMAND_PALETTE_TAKE_PER_TYPE,
    });
    return documents.map((d) => ({
      id: d.id,
      name: d.title,
      type: "knowledge-base" as const,
      subtitle: d.status,
      href: "/dashboard/knowledge-base",
    }));
  },
];

// Round-robin so every entity type is represented before the cap is applied,
// instead of the first few searchers filling the whole list.
function interleaveResults(groups: CommandPaletteResult[][]): CommandPaletteResult[] {
  const interleaved: CommandPaletteResult[] = [];
  const longestGroup = Math.max(0, ...groups.map((group) => group.length));

  for (let index = 0; index < longestGroup; index++) {
    for (const group of groups) {
      const result = group[index];
      if (result) {
        interleaved.push(result);
      }
    }
  }

  return interleaved;
}

export async function searchCommandPalette(query: string): Promise<{
  data: CommandPaletteResult[] | null;
  error: string | null;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DEVELOPER")) {
      return { data: null, error: "Only admins and developers can use search" };
    }

    if (!query || query.trim().length < 2) {
      return { data: [], error: null };
    }

    const searchTerm = query.trim();
    const searchers =
      currentUser.role === "ADMIN"
        ? [...developerSearchers, ...adminSearchers]
        : developerSearchers;

    console.log(
      `[CommandPalette] searching ${searchers.length} entity types for "${searchTerm}" as ${currentUser.role}...`
    );

    // A single failing entity search shouldn't blank the whole palette.
    const settled = await Promise.allSettled(searchers.map((search) => search(searchTerm)));

    const groups: CommandPaletteResult[][] = [];
    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        groups.push(outcome.value);
      } else {
        console.error("[CommandPalette] entity search failed:", outcome.reason);
      }
    }

    const results = interleaveResults(groups).slice(0, COMMAND_PALETTE_MAX_RESULTS);
    console.log(`[CommandPalette] returning ${results.length} results`);

    return { data: results, error: null };
  } catch (error) {
    console.error("Error searching command palette:", error);
    return { data: null, error: "Failed to search" };
  }
}

export async function acceptRequest(
  id: string,
  taskData: {
    name: string;
    description?: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    status: "PENDING_ADMIN_REVIEW" | "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
    dueDate?: Date;
    assigneeId?: string;
    blockedByTaskIds?: string[];
    blockedByActionItemIds?: string[];
    // Attachment to link (e.g., screen recording from bug report)
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentType?: string;
    attachmentSize?: number;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DEVELOPER")) {
      return { data: null, error: "Only admins and developers can accept requests" };
    }

    const existingRequest = await prisma.request.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return { data: null, error: "Request not found" };
    }

    if (existingRequest.status !== "SUBMITTED") {
      return { data: null, error: "Can only accept requests with status 'Submitted'" };
    }

    // Create task and update request in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the task
      const task = await tx.task.create({
        data: {
          name: taskData.name,
          description: taskData.description,
          priority: taskData.priority,
          status: taskData.status,
          dueDate: taskData.dueDate,
          clientCompanyId: existingRequest.clientCompanyId,
          assigneeId: taskData.assigneeId,
          ...(taskData.blockedByTaskIds && taskData.blockedByTaskIds.length > 0 && {
            blockedByTasks: {
              connect: taskData.blockedByTaskIds.map((taskId) => ({ id: taskId })),
            },
          }),
          ...(taskData.blockedByActionItemIds && taskData.blockedByActionItemIds.length > 0 && {
            blockedByActionItems: {
              connect: taskData.blockedByActionItemIds.map((actionItemId) => ({ id: actionItemId })),
            },
          }),
        },
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

      // Create attachment if provided (e.g., screen recording from bug report)
      if (taskData.attachmentUrl) {
        await tx.attachment.create({
          data: {
            name: taskData.attachmentName || "Screen Recording",
            url: taskData.attachmentUrl,
            type: taskData.attachmentType || "video/mp4",
            size: taskData.attachmentSize || 0,
            taskId: task.id,
          },
        });
      }

      // Update the request with accepted status and link to task
      const request = await tx.request.update({
        where: { id },
        data: {
          status: "ACCEPTED",
          taskId: task.id,
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
      });

      return { request, task };
    });

    revalidatePath("/dashboard/feature-requests");
    revalidatePath("/dashboard/bug-requests");
    revalidatePath("/dashboard/tasks");
    return { data: result, error: null };
  } catch (error) {
    console.error("Error accepting request:", error);
    return { data: null, error: "Failed to accept request" };
  }
}

// ============================================
// SLACK NOTIFICATION CONFIG ACTIONS
// ============================================

import {
  SlackNotificationConfigData,
  ClientNotificationSettings,
} from "@/lib/slack-notification-constants";

export async function getClientNotificationSettings(): Promise<{
  data: ClientNotificationSettings[] | null;
  error: string | null;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can view notification settings" };
    }

    const clients = await prisma.company.findMany({
      orderBy: { name: "asc" },
      include: {
        slackNotificationConfigs: true,
      },
    });

    const settings: ClientNotificationSettings[] = clients.map((client) => ({
      clientCompanyId: client.id,
      clientName: client.name,
      slackPublicChannelId: client.slackPublicChannelId,
      slackInternalChannelId: client.slackInternalChannelId,
      configs: client.slackNotificationConfigs,
    }));

    return { data: settings, error: null };
  } catch (error) {
    console.error("Error fetching notification settings:", error);
    return { data: null, error: "Failed to fetch notification settings" };
  }
}

export async function updateNotificationConfig(
  clientCompanyId: string,
  eventType: SlackNotificationEventType,
  sendToPublic: boolean,
  sendToInternal: boolean
): Promise<{ data: SlackNotificationConfigData | null; error: string | null }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can update notification settings" };
    }

    // Verify client exists
    const client = await prisma.company.findUnique({
      where: { id: clientCompanyId },
    });

    if (!client) {
      return { data: null, error: "Client not found" };
    }

    // Upsert the config
    const config = await prisma.slackNotificationConfig.upsert({
      where: {
        clientCompanyId_eventType: {
          clientCompanyId,
          eventType,
        },
      },
      update: {
        sendToPublic,
        sendToInternal,
      },
      create: {
        clientCompanyId,
        eventType,
        sendToPublic,
        sendToInternal,
      },
    });

    revalidatePath("/dashboard/notifications");
    return { data: config, error: null };
  } catch (error) {
    console.error("Error updating notification config:", error);
    return { data: null, error: "Failed to update notification config" };
  }
}

export async function testNotification(
  clientCompanyId: string,
  eventType: SlackNotificationEventType
): Promise<{ data: { sent: boolean; message: string } | null; error: string | null }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can test notifications" };
    }

    // Get the client and check if notification is configured
    const client = await prisma.company.findUnique({
      where: { id: clientCompanyId },
      include: {
        slackNotificationConfigs: {
          where: { eventType },
        },
      },
    });

    if (!client) {
      return { data: null, error: "Client not found" };
    }

    const config = client.slackNotificationConfigs[0];
    if (!config || (!config.sendToPublic && !config.sendToInternal)) {
      return { data: null, error: "Notification not enabled for this event type" };
    }

    // Check if any channel is configured
    const hasPublicChannel = config.sendToPublic && client.slackPublicChannelId;
    const hasInternalChannel = config.sendToInternal && client.slackInternalChannelId;
    
    if (!hasPublicChannel && !hasInternalChannel) {
      return { data: null, error: "No Slack channel configured for enabled notification" };
    }

    let messageText = "";
    let itemFound = false;

    switch (eventType) {
      case "ACTION_ITEM_CREATED": {
        const actionItem = await prisma.actionItem.findFirst({
          where: { clientCompanyId },
          orderBy: { createdAt: "desc" },
        });
        if (actionItem) {
          await notifyActionItemCreated(clientCompanyId, actionItem.id, actionItem.name, actionItem.priority);
          messageText = `Sent test: Action Item "${actionItem.name}"`;
          itemFound = true;
        } else {
          await notifyActionItemCreated(clientCompanyId, "test-placeholder", "[Test] Example Action Item", "MEDIUM");
          messageText = "Sent test with placeholder action item";
        }
        break;
      }
      case "TASK_COMPLETED": {
        const task = await prisma.task.findFirst({
          where: { clientCompanyId, status: "DONE" },
          include: { assignee: true },
          orderBy: { updatedAt: "desc" },
        });
        if (task) {
          await notifyTaskCompleted(clientCompanyId, task.id, task.name, task.assignee?.email);
          messageText = `Sent test: Task "${task.name}"`;
          itemFound = true;
        } else {
          await notifyTaskCompleted(clientCompanyId, "test-placeholder", "[Test] Example Completed Task", "developer@example.com");
          messageText = "Sent test with placeholder task";
        }
        break;
      }
      case "ACTION_ITEM_COMPLETED": {
        const actionItem = await prisma.actionItem.findFirst({
          where: { clientCompanyId, status: "DONE" },
          orderBy: { updatedAt: "desc" },
        });
        if (actionItem) {
          await notifyActionItemCompleted(clientCompanyId, actionItem.id, actionItem.name);
          messageText = `Sent test: Action Item "${actionItem.name}"`;
          itemFound = true;
        } else {
          await notifyActionItemCompleted(clientCompanyId, "test-placeholder", "[Test] Example Completed Action Item");
          messageText = "Sent test with placeholder action item";
        }
        break;
      }
      case "TASK_UNBLOCKED": {
        const task = await prisma.task.findFirst({
          where: { clientCompanyId },
          orderBy: { createdAt: "desc" },
        });
        if (task) {
          await notifyTaskUnblocked(clientCompanyId, task.id, task.name);
          messageText = `Sent test: Task "${task.name}"`;
          itemFound = true;
        } else {
          await notifyTaskUnblocked(clientCompanyId, "test-placeholder", "[Test] Example Task");
          messageText = "Sent test with placeholder task";
        }
        break;
      }
      case "FEATURE_REQUESTED": {
        const request = await prisma.request.findFirst({
          where: { clientCompanyId, type: "FEATURE" },
          orderBy: { createdAt: "desc" },
        });
        if (request) {
          await notifyFeatureRequested(clientCompanyId, request.id, request.title, request.priority);
          messageText = `Sent test: Feature Request "${request.title}"`;
          itemFound = true;
        } else {
          await notifyFeatureRequested(clientCompanyId, "test-placeholder", "[Test] Example Feature Request", "MEDIUM");
          messageText = "Sent test with placeholder feature request";
        }
        break;
      }
      case "BUG_REQUESTED": {
        const request = await prisma.request.findFirst({
          where: { clientCompanyId, type: "BUG" },
          orderBy: { createdAt: "desc" },
        });
        if (request) {
          await notifyBugRequested(clientCompanyId, request.id, request.title, request.bugSeverity || undefined);
          messageText = `Sent test: Bug Report "${request.title}"`;
          itemFound = true;
        } else {
          await notifyBugRequested(clientCompanyId, "test-placeholder", "[Test] Example Bug Report", "MEDIUM");
          messageText = "Sent test with placeholder bug report";
        }
        break;
      }
      default:
        return { data: null, error: "Unknown event type" };
    }

    return {
      data: {
        sent: true,
        message: itemFound ? messageText : messageText + " (no matching items found)",
      },
      error: null,
    };
  } catch (error) {
    console.error("Error testing notification:", error);
    return { data: null, error: "Failed to send test notification" };
  }
}

// ============================================
// MEETING ACTIONS
// ============================================

interface MeetingSummaryResult {
  summary: string;
  nextStepsJaroDev: Array<{ title: string; description: string }>;
  nextStepsClient: Array<{ title: string; description: string }>;
}

async function generateMeetingSummaryForRerun(
  transcript: string,
  clientCompanyName: string | null
): Promise<MeetingSummaryResult> {
  console.log("[Rerun AI] AI Analysis: Starting summary generation...");
  console.log(`[Rerun AI] AI Analysis: Client company="${clientCompanyName || "Unknown"}"`);
  console.log(`[Rerun AI] AI Analysis: Transcript length=${transcript.length} chars`);

  const OpenAI = (await import("openai")).default;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error("[Rerun AI] AI Analysis: OPENAI_API_KEY not configured");
    throw new Error("OPENAI_API_KEY not configured");
  }
  console.log("[Rerun AI] AI Analysis: OpenAI API key configured");

  const openai = new OpenAI({ apiKey: openaiApiKey });

  const systemPrompt = `You are a meeting analyst for Jaro.dev, a software development agency that builds MVPs for startups and companies. 
Your task is to analyze meeting transcripts and extract:
1. A concise summary of the meeting (2-3 paragraphs)
2. Next steps for Jaro.dev (the development team) - DEVELOPMENT TASKS ONLY
3. Next steps for the Client

JARO.DEV TEAM MEMBERS:
- Anyone with a @jaro.dev email address is a Jaro.dev team member.
- zenoshubh@gmail.com (Shubh) is a Jaro.dev team member (employee), NOT a client.
- Any task, action, or next step assigned to a Jaro.dev team member belongs in the Jaro.dev next steps (development tasks), NOT in the client next steps.

CRITICAL RULES FOR JARO.DEV NEXT STEPS (DEVELOPMENT TASKS):
- ONLY include DEVELOPMENT-RELATED tasks (coding, building features, fixing bugs, implementing functionality, technical work)
- DO NOT include business tasks like "schedule a meeting", "send an email", "follow up", "discuss pricing", "prepare proposal", etc.
- ONLY include tasks that were EXPLICITLY mentioned or agreed upon during the call
- DO NOT invent, assume, or infer tasks that weren't actually discussed
- Each task must be something that requires actual development/engineering work
- If no development tasks were mentioned, return an empty array
- Any mention of yaro / Yaro in the transcript should be corrected to Jaro.

CRITICAL RULES FOR CLIENT NEXT STEPS:
- ONLY generate next steps for items which are actually relevant to the client
- Jaro.dev internal matters are not relevant next steps for the client
- ONLY include next steps that were EXPLICITLY mentioned or agreed upon during the call
- If no clear next steps were mentioned for the client, return an empty array

FOR JARO.DEV DEVELOPMENT TASKS, provide detailed descriptions that include:
- A clear, actionable title (max 100 characters) based on what was actually said
- A comprehensive description with ALL technical details discussed, including:
  * The specific feature/functionality to be built or bug to be fixed
  * Any technical requirements, constraints, or preferences mentioned
  * User flows or behavior expectations discussed
  * UI/UX details if mentioned (screens, buttons, layouts, interactions)
  * Data requirements (what data to display, store, or process)
  * Integration points with other systems or APIs if discussed
  * Edge cases or error handling requirements mentioned
  * Any examples or references provided during the call
  * Acceptance criteria or success conditions discussed
  * Dependencies or blockers mentioned
- Include exact quotes or close paraphrases from the conversation for clarity

FOR CLIENT NEXT STEPS, provide:
- A clear, actionable title (max 100 characters)
- A brief description with the specific context from the conversation

Format your response as JSON with this exact structure:
{
  "summary": "string",
  "nextStepsJaroDev": [{"title": "string", "description": "string"}],
  "nextStepsClient": [{"title": "string", "description": "string"}]
}

Remember: Only extract REAL development tasks that were ACTUALLY mentioned in the transcript. It's better to have fewer accurate, detailed tasks than to include invented or vague ones.`;

  const userPrompt = `Analyze this meeting transcript${clientCompanyName ? ` with client "${clientCompanyName}"` : ""}:

${transcript}

Extract the summary and next steps as specified.`;

  console.log("[Rerun AI] AI Analysis: Sending request to OpenAI (model: gpt-5-mini)...");
  const startTime = Date.now();

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const elapsed = Date.now() - startTime;
  console.log(`[Rerun AI] AI Analysis: OpenAI response received in ${elapsed}ms`);
  console.log(`[Rerun AI] AI Analysis: Token usage - prompt: ${response.usage?.prompt_tokens}, completion: ${response.usage?.completion_tokens}, total: ${response.usage?.total_tokens}`);

  const content = response.choices[0]?.message?.content;
  if (!content) {
    console.error("[Rerun AI] AI Analysis: Empty response from OpenAI");
    throw new Error("Empty response from OpenAI");
  }
  console.log(`[Rerun AI] AI Analysis: Response content length=${content.length} chars`);

  console.log("[Rerun AI] AI Analysis: Parsing JSON response...");
  const result = JSON.parse(content) as MeetingSummaryResult;

  console.log("[Rerun AI] AI Analysis: Parse successful");
  console.log(`[Rerun AI] AI Analysis: Summary preview="${result.summary?.substring(0, 100)}..."`);
  console.log(`[Rerun AI] AI Analysis: Jaro.dev steps count=${result.nextStepsJaroDev?.length || 0}`);
  console.log(`[Rerun AI] AI Analysis: Client steps count=${result.nextStepsClient?.length || 0}`);

  return {
    summary: result.summary || "",
    nextStepsJaroDev: Array.isArray(result.nextStepsJaroDev) ? result.nextStepsJaroDev : [],
    nextStepsClient: Array.isArray(result.nextStepsClient) ? result.nextStepsClient : [],
  };
}

export async function regenerateMeetingAnalysis(meetingId: string): Promise<{
  data: {
    summary: string;
    tasksCreated: number;
    actionItemsCreated: number;
  } | null;
  error: string | null;
}> {
  console.log("[Rerun AI] ========== REGENERATING MEETING ANALYSIS ==========");
  console.log(`[Rerun AI] Meeting ID: ${meetingId}`);

  try {
    // Step 1: Authentication check
    console.log("[Rerun AI] Step 1: Checking authentication...");
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log("[Rerun AI] Step 1 FAILED: User not authenticated");
      return { data: null, error: "Not authenticated" };
    }
    console.log(`[Rerun AI] Step 1 complete: User authenticated as ${session.user.email}`);

    // Step 2: Admin check
    console.log("[Rerun AI] Step 2: Checking admin permissions...");
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      console.log(`[Rerun AI] Step 2 FAILED: User is not admin (role: ${currentUser?.role})`);
      return { data: null, error: "Only admins can regenerate meeting analysis" };
    }
    console.log("[Rerun AI] Step 2 complete: User is admin");

    // Step 3: Fetch meeting
    console.log("[Rerun AI] Step 3: Fetching meeting from database...");
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        clientCompany: true,
      },
    });

    if (!meeting) {
      console.log("[Rerun AI] Step 3 FAILED: Meeting not found");
      return { data: null, error: "Meeting not found" };
    }
    console.log(`[Rerun AI] Step 3 complete: Meeting found - "${meeting.title}"`);
    console.log(`[Rerun AI]   - Client company: ${meeting.clientCompany?.name || "NONE"}`);
    console.log(`[Rerun AI]   - Transcript length: ${meeting.formattedTranscript?.length || 0} chars`);

    if (!meeting.formattedTranscript) {
      console.log("[Rerun AI] Step 3 FAILED: No transcript available");
      return { data: null, error: "No transcript available for this meeting" };
    }

    // Step 4: Delete existing tasks and action items
    console.log("[Rerun AI] Step 4: Deleting existing tasks and action items...");
    const deletedTasks = await prisma.task.deleteMany({
      where: { meetingId: meeting.id },
    });
    console.log(`[Rerun AI]   - Deleted ${deletedTasks.count} existing tasks`);

    const deletedActionItems = await prisma.actionItem.deleteMany({
      where: { meetingId: meeting.id },
    });
    console.log(`[Rerun AI]   - Deleted ${deletedActionItems.count} existing action items`);
    console.log("[Rerun AI] Step 4 complete");

    // Step 5: Generate new summary and next steps
    console.log("[Rerun AI] Step 5: Generating new AI summary...");
    const summaryResult = await generateMeetingSummaryForRerun(
      meeting.formattedTranscript,
      meeting.clientCompany?.name || null
    );
    console.log("[Rerun AI] Step 5 complete: AI analysis finished");
    console.log(`[Rerun AI]   - Summary length: ${summaryResult.summary.length} chars`);
    console.log(`[Rerun AI]   - Jaro.dev next steps: ${summaryResult.nextStepsJaroDev.length}`);
    console.log(`[Rerun AI]   - Client next steps: ${summaryResult.nextStepsClient.length}`);
    if (summaryResult.nextStepsJaroDev.length > 0) {
      console.log(`[Rerun AI]   - Jaro.dev tasks: ${summaryResult.nextStepsJaroDev.map(s => s.title).join("; ")}`);
    }
    if (summaryResult.nextStepsClient.length > 0) {
      console.log(`[Rerun AI]   - Client action items: ${summaryResult.nextStepsClient.map(s => s.title).join("; ")}`);
    }

    // Step 6: Update meeting in database
    console.log("[Rerun AI] Step 6: Updating meeting in database...");
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        summary: summaryResult.summary || null,
        nextStepsJaroDev: summaryResult.nextStepsJaroDev.length > 0
          ? JSON.stringify(summaryResult.nextStepsJaroDev)
          : null,
        nextStepsClient: summaryResult.nextStepsClient.length > 0
          ? JSON.stringify(summaryResult.nextStepsClient)
          : null,
      },
    });
    console.log("[Rerun AI] Step 6 complete: Meeting updated");

    // Step 7: Create new tasks and action items
    let tasksCreated = 0;
    let actionItemsCreated = 0;

    if (meeting.clientCompanyId) {
      console.log("[Rerun AI] Step 7: Creating new tasks and action items...");

      // The current meeting's tasks/action items were deleted in Step 4, so the
      // remaining open items belong to other calls. Skip semantic duplicates of those.
      console.log("[Rerun AI]   - Fetching existing open tasks/action items for duplicate check...");
      const [existingTasks, existingActionItems] = await Promise.all([
        prisma.task.findMany({
          where: { clientCompanyId: meeting.clientCompanyId, status: { not: "DONE" } },
          select: { name: true, description: true },
        }),
        prisma.actionItem.findMany({
          where: { clientCompanyId: meeting.clientCompanyId, status: { not: "DONE" } },
          select: { name: true, description: true },
        }),
      ]);

      const tasksToCreate = await filterDuplicateSteps(
        summaryResult.nextStepsJaroDev,
        existingTasks,
        { logPrefix: "[Rerun AI] Task dedup" }
      );

      const actionItemsToCreate = await filterDuplicateSteps(
        summaryResult.nextStepsClient,
        existingActionItems,
        { logPrefix: "[Rerun AI] Action item dedup" }
      );

      for (const step of tasksToCreate) {
        await prisma.task.create({
          data: {
            name: step.title,
            description: `${step.description}\n\n---\nFrom meeting: ${meeting.title}`,
            priority: "MEDIUM",
            status: "TODO",
            clientCompanyId: meeting.clientCompanyId,
            meetingId: meeting.id,
            createdByJaroDevAutomation: true,
          },
        });
        tasksCreated++;
        console.log(`[Rerun AI]   - Created task: "${step.title}"`);
      }

      for (const step of actionItemsToCreate) {
        await prisma.actionItem.create({
          data: {
            name: step.title,
            description: `${step.description}\n\n---\nFrom meeting: ${meeting.title}`,
            priority: "MEDIUM",
            status: "TODO",
            clientCompanyId: meeting.clientCompanyId,
            meetingId: meeting.id,
            createdByJaroDevAutomation: true,
          },
        });
        actionItemsCreated++;
        console.log(`[Rerun AI]   - Created action item: "${step.title}"`);
      }
      console.log(`[Rerun AI] Step 7 complete: Created ${tasksCreated} tasks and ${actionItemsCreated} action items`);
    } else {
      console.log("[Rerun AI] Step 7: Skipping task/action item creation (no client company)");
    }

    // Step 8: Revalidate path
    console.log("[Rerun AI] Step 8: Revalidating path...");
    revalidatePath(`/dashboard/clients/${meeting.clientCompanyId}`);
    console.log("[Rerun AI] Step 8 complete");

    console.log("[Rerun AI] ========== REGENERATION COMPLETE ==========");
    console.log(`[Rerun AI] Summary: ${tasksCreated} tasks, ${actionItemsCreated} action items created`);

    return {
      data: {
        summary: summaryResult.summary,
        tasksCreated,
        actionItemsCreated,
      },
      error: null,
    };
  } catch (error) {
    console.error("[Rerun AI] ========== ERROR ==========");
    console.error("[Rerun AI] Error regenerating meeting analysis:", error);
    console.error("[Rerun AI] Error details:", error instanceof Error ? error.message : String(error));
    return { data: null, error: "Failed to regenerate meeting analysis" };
  }
}

// ============================================
// SALES CALL MAP ACTIONS
// ============================================

export async function createSalesCallMap(data: {
  name: string;
  notes?: string;
  clientCompanyId?: string;
  meetingId?: string;
  formSubmissionId?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can create sales call maps" };
    }

    const salesCallMap = await prisma.salesCallMap.create({
      data: {
        name: data.name,
        notes: data.notes,
        clientCompanyId: data.clientCompanyId || null,
        meetingId: data.meetingId || null,
        formSubmissionId: data.formSubmissionId || null,
        auditData: {
          sections: {},
          keyFindings: [],
          estimatedHoursLostPerWeek: 0,
          recommendedNextSteps: [],
        },
      },
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
    });

    revalidatePath("/dashboard/sales-call-maps");

    return { data: salesCallMap, error: null };
  } catch (error) {
    console.error("Error creating sales call map:", error);
    return { data: null, error: "Failed to create sales call map" };
  }
}

export async function updateSalesCallMap(
  id: string,
  data: {
    name?: string;
    notes?: string;
    clientCompanyId?: string | null;
    meetingId?: string | null;
    formSubmissionId?: string | null;
    auditData?: Prisma.InputJsonValue;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can update sales call maps" };
    }

    const salesCallMap = await prisma.salesCallMap.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.clientCompanyId !== undefined && { clientCompanyId: data.clientCompanyId }),
        ...(data.meetingId !== undefined && { meetingId: data.meetingId }),
        ...(data.formSubmissionId !== undefined && { formSubmissionId: data.formSubmissionId }),
        ...(data.auditData !== undefined && { auditData: data.auditData }),
      },
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
    });

    revalidatePath("/dashboard/sales-call-maps");
    revalidatePath(`/dashboard/sales-call-maps/${id}`);

    return { data: salesCallMap, error: null };
  } catch (error) {
    console.error("Error updating sales call map:", error);
    return { data: null, error: "Failed to update sales call map" };
  }
}

export async function deleteSalesCallMap(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can delete sales call maps" };
    }

    await prisma.salesCallMap.delete({
      where: { id },
    });

    revalidatePath("/dashboard/sales-call-maps");

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Error deleting sales call map:", error);
    return { data: null, error: "Failed to delete sales call map" };
  }
}

// ============================================
// SHARED QUOTES
// ============================================

interface CreateSharedQuoteData {
  salesCallMapId: string;
  companyName: string;
  contactName?: string;
  contactEmail?: string;
  lineItems: Array<{
    code: string;
    module: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    benefit?: string;
    parts?: Array<{
      name: string;
      price: number;
      objective: string;
    }>;
  }>;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  deposit: number;
  balance: number;
  painPoints?: Array<{ section: string; items: string[] }>;
  expiresAt: Date;
  onCallDiscountPercent?: number;
}

export async function createSharedQuote(data: CreateSharedQuoteData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can create shared quotes" };
    }

    // Calculate on-call discount amounts (15% by default)
    const onCallDiscountPercent = data.onCallDiscountPercent ?? 15;
    const onCallDiscountAmount = Math.round(data.total * (onCallDiscountPercent / 100));
    const onCallTotal = data.total - onCallDiscountAmount;
    const onCallDeposit = Math.round(onCallTotal * 0.2);
    const onCallBalance = onCallTotal - onCallDeposit;

    const sharedQuote = await prisma.sharedQuote.create({
      data: {
        salesCallMapId: data.salesCallMapId,
        companyName: data.companyName,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        lineItems: data.lineItems as Prisma.InputJsonValue,
        subtotal: data.subtotal,
        discountPercent: data.discountPercent,
        discountAmount: data.discountAmount,
        total: data.total,
        deposit: data.deposit,
        balance: data.balance,
        onCallDiscountPercent,
        onCallTotal,
        onCallDeposit,
        onCallBalance,
        painPoints: data.painPoints as Prisma.InputJsonValue,
        expiresAt: data.expiresAt,
      },
    });

    revalidatePath(`/dashboard/sales-call-maps/${data.salesCallMapId}`);

    return { data: sharedQuote, error: null };
  } catch (error) {
    console.error("Error creating shared quote:", error);
    return { data: null, error: "Failed to create shared quote" };
  }
}

export async function getSharedQuoteByToken(token: string) {
  try {
    const sharedQuote = await prisma.sharedQuote.findUnique({
      where: { token },
      include: {
        salesCallMap: {
          select: {
            id: true,
            name: true,
            clientCompany: {
              select: {
                id: true,
                name: true,
                website: true,
              },
            },
          },
        },
      },
    });

    if (!sharedQuote) {
      return { data: null, error: "Quote not found" };
    }

    // Check if expired
    if (new Date() > sharedQuote.expiresAt) {
      return { data: null, error: "This quote has expired" };
    }

    // Increment view count
    await prisma.sharedQuote.update({
      where: { token },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    });

    return { data: sharedQuote, error: null };
  } catch (error) {
    console.error("Error fetching shared quote:", error);
    return { data: null, error: "Failed to fetch quote" };
  }
}

/**
 * Create a Stripe checkout session for a quote deposit payment
 */
export async function createQuoteCheckoutSession(
  quoteToken: string,
  baseUrl: string,
  customerEmail?: string
) {
  try {
    // Dynamically import stripe to avoid issues with server-side initialization
    const { stripe } = await import("@/lib/stripe");

    // Fetch the quote
    const quote = await prisma.sharedQuote.findUnique({
      where: { token: quoteToken },
      include: {
        salesCallMap: {
          include: {
            clientCompany: true,
          },
        },
      },
    });

    if (!quote) {
      return { data: null, error: "Quote not found" };
    }

    if (new Date() > quote.expiresAt) {
      return { data: null, error: "This quote has expired" };
    }

    // Check if already paid
    if (quote.depositPaidAt) {
      return { data: null, error: "This quote has already been paid" };
    }

    // Calculate the deposit amount based on discount eligibility
    const created = new Date(quote.createdAt);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    const isSameDayDiscountEligible = hoursSinceCreation <= 24;

    const depositAmount = isSameDayDiscountEligible ? quote.onCallDeposit : quote.deposit;
    const totalAmount = isSameDayDiscountEligible ? quote.onCallTotal : quote.total;

    // Use provided email or fall back to quote contact email
    const email = customerEmail || quote.contactEmail;

    // Create or get Stripe customer
    let customerId: string;

    // Check if we have an existing customer for this email
    if (email) {
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: email,
          name: quote.contactName || quote.companyName,
          metadata: {
            companyName: quote.companyName,
            quoteId: quote.id,
          },
        });
        customerId = customer.id;
      }
    } else {
      // Create customer without email
      const customer = await stripe.customers.create({
        name: quote.contactName || quote.companyName,
        metadata: {
          companyName: quote.companyName,
          quoteId: quote.id,
        },
      });
      customerId = customer.id;
    }

    // Create Stripe checkout session with customer-initiated bank transfer
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["customer_balance"],
      payment_method_options: {
        customer_balance: {
          funding_type: "bank_transfer",
          bank_transfer: {
            type: "us_bank_transfer",
          },
        },
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Deposit for ${quote.companyName}`,
              description: `20% deposit${isSameDayDiscountEligible ? " - same-day discount applied" : ""}`,
            },
            unit_amount: Math.round(depositAmount * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/quote/${quoteToken}?payment=success`,
      cancel_url: `${baseUrl}/quote/${quoteToken}?payment=cancelled`,
      metadata: {
        quoteToken,
        quoteId: quote.id,
        companyName: quote.companyName,
        depositAmount: depositAmount.toString(),
        totalAmount: totalAmount.toString(),
        discountApplied: isSameDayDiscountEligible ? "true" : "false",
      },
    });

    // Store the checkout session ID
    await prisma.sharedQuote.update({
      where: { id: quote.id },
      data: {
        stripeSessionId: session.id,
      },
    });

    return { data: { url: session.url }, error: null };
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return { data: null, error: "Failed to create payment session" };
  }
}

/**
 * Delete a shared quote
 */
export async function deleteSharedQuote(quoteId: string, salesCallMapId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Unauthorized" };
    }

    // Verify user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || user.role !== "ADMIN") {
      return { data: null, error: "Unauthorized" };
    }

    // Delete the quote
    await prisma.sharedQuote.delete({
      where: { id: quoteId },
    });

    revalidatePath(`/dashboard/sales-call-maps/${salesCallMapId}/sales-view`);

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Error deleting shared quote:", error);
    return { data: null, error: "Failed to delete quote" };
  }
}

// ============================================
// RECURRING TASKS
// ============================================

export interface RecurringTaskData {
  id: string;
  name: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  isActive: boolean;
  lastCreatedAt: Date | null;
  clientCompanyId: string;
  clientCompany: {
    id: string;
    name: string;
  };
  assigneeId: string | null;
  assignee: {
    id: string;
    email: string;
    firstName: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new recurring task
 */
export async function createRecurringTask(data: {
  name: string;
  description?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  dayOfWeek?: number;
  dayOfMonth?: number;
  clientCompanyId: string;
  assigneeId?: string;
}): Promise<{ data: RecurringTaskData | null; error: string | null }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin or developer
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DEVELOPER")) {
      return { data: null, error: "Only admins and developers can create recurring tasks" };
    }

    const recurringTask = await prisma.recurringTask.create({
      data: {
        name: data.name,
        description: data.description,
        priority: data.priority,
        frequency: data.frequency,
        dayOfWeek: data.frequency === "WEEKLY" ? data.dayOfWeek : null,
        dayOfMonth: data.frequency === "MONTHLY" ? data.dayOfMonth : null,
        clientCompanyId: data.clientCompanyId,
        assigneeId: data.assigneeId,
      },
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

    revalidatePath("/dashboard/recurring-tasks");
    return { data: recurringTask as RecurringTaskData, error: null };
  } catch (error) {
    console.error("Error creating recurring task:", error);
    return { data: null, error: "Failed to create recurring task" };
  }
}

/**
 * Update an existing recurring task
 */
export async function updateRecurringTask(
  id: string,
  data: {
    name?: string;
    description?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    frequency?: "DAILY" | "WEEKLY" | "MONTHLY";
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    isActive?: boolean;
    clientCompanyId?: string;
    assigneeId?: string | null;
  }
): Promise<{ data: RecurringTaskData | null; error: string | null }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DEVELOPER")) {
      return { data: null, error: "Only admins and developers can update recurring tasks" };
    }

    // Build update data, adjusting dayOfWeek/dayOfMonth based on frequency
    const updateData: Prisma.RecurringTaskUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.clientCompanyId !== undefined) {
      updateData.clientCompany = { connect: { id: data.clientCompanyId } };
    }
    if (data.assigneeId !== undefined) {
      if (data.assigneeId === null) {
        updateData.assignee = { disconnect: true };
      } else {
        updateData.assignee = { connect: { id: data.assigneeId } };
      }
    }
    if (data.frequency !== undefined) {
      updateData.frequency = data.frequency;
      // Reset day fields when frequency changes
      if (data.frequency === "DAILY") {
        updateData.dayOfWeek = null;
        updateData.dayOfMonth = null;
      } else if (data.frequency === "WEEKLY") {
        updateData.dayOfWeek = data.dayOfWeek ?? null;
        updateData.dayOfMonth = null;
      } else if (data.frequency === "MONTHLY") {
        updateData.dayOfWeek = null;
        updateData.dayOfMonth = data.dayOfMonth ?? null;
      }
    } else {
      // Frequency not changing, but day fields might be
      if (data.dayOfWeek !== undefined) updateData.dayOfWeek = data.dayOfWeek;
      if (data.dayOfMonth !== undefined) updateData.dayOfMonth = data.dayOfMonth;
    }

    const recurringTask = await prisma.recurringTask.update({
      where: { id },
      data: updateData,
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

    revalidatePath("/dashboard/recurring-tasks");
    return { data: recurringTask as RecurringTaskData, error: null };
  } catch (error) {
    console.error("Error updating recurring task:", error);
    return { data: null, error: "Failed to update recurring task" };
  }
}

/**
 * Delete a recurring task
 */
export async function deleteRecurringTask(id: string): Promise<{ data: { success: boolean } | null; error: string | null }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DEVELOPER")) {
      return { data: null, error: "Only admins and developers can delete recurring tasks" };
    }

    await prisma.recurringTask.delete({
      where: { id },
    });

    revalidatePath("/dashboard/recurring-tasks");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Error deleting recurring task:", error);
    return { data: null, error: "Failed to delete recurring task" };
  }
}

/**
 * Toggle a recurring task's active status
 */
export async function toggleRecurringTaskActive(id: string): Promise<{ data: RecurringTaskData | null; error: string | null }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DEVELOPER")) {
      return { data: null, error: "Only admins and developers can toggle recurring tasks" };
    }

    // Get current status
    const current = await prisma.recurringTask.findUnique({
      where: { id },
      select: { isActive: true },
    });

    if (!current) {
      return { data: null, error: "Recurring task not found" };
    }

    const recurringTask = await prisma.recurringTask.update({
      where: { id },
      data: { isActive: !current.isActive },
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

    revalidatePath("/dashboard/recurring-tasks");
    return { data: recurringTask as RecurringTaskData, error: null };
  } catch (error) {
    console.error("Error toggling recurring task:", error);
    return { data: null, error: "Failed to toggle recurring task" };
  }
}

// ============================================
// MVP CALL MAPS
// ============================================

export async function createMVPCallMap(data: {
  name: string;
  notes?: string;
  clientCompanyId?: string;
  formSubmissionId?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can create MVP call maps" };
    }

    const mvpCallMap = await prisma.mVPCallMap.create({
      data: {
        name: data.name,
        notes: data.notes,
        clientCompanyId: data.clientCompanyId || null,
        formSubmissionId: data.formSubmissionId || null,
        flowData: {
          nodes: [],
          edges: [],
        },
        configuratorData: {
          authProviders: [],
          teamFeatures: {
            inviteMembers: false,
            predefinedRoles: false,
            customRoles: false,
            bulkInvite: false,
          },
          dnsSetup: {
            customSubdomains: false,
            additionalDomainConfig: false,
          },
          emailSetup: {
            transactionalEmails: false,
            welcomeEmail: false,
            adminEmails: [],
          },
          toggles: {
            landingPage: false,
            responsiveDesign: true,
            figmaBrand: false,
            customUI: false,
            stripeIntegration: false,
            uiAnimations: false,
            darkMode: false,
          },
        },
      },
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
    });

    revalidatePath("/dashboard/mvp-call-maps");

    return { data: mvpCallMap, error: null };
  } catch (error) {
    console.error("Error creating MVP call map:", error);
    return { data: null, error: "Failed to create MVP call map" };
  }
}

export async function updateMVPCallMap(
  id: string,
  data: {
    name?: string;
    notes?: string;
    clientCompanyId?: string | null;
    formSubmissionId?: string | null;
    flowData?: Prisma.InputJsonValue;
    configuratorData?: Prisma.InputJsonValue;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can update MVP call maps" };
    }

    const mvpCallMap = await prisma.mVPCallMap.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.clientCompanyId !== undefined && { clientCompanyId: data.clientCompanyId }),
        ...(data.formSubmissionId !== undefined && { formSubmissionId: data.formSubmissionId }),
        ...(data.flowData !== undefined && { flowData: data.flowData }),
        ...(data.configuratorData !== undefined && { configuratorData: data.configuratorData }),
      },
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
    });

    revalidatePath("/dashboard/mvp-call-maps");
    revalidatePath(`/dashboard/mvp-call-maps/${id}`);

    return { data: mvpCallMap, error: null };
  } catch (error) {
    console.error("Error updating MVP call map:", error);
    return { data: null, error: "Failed to update MVP call map" };
  }
}

export async function deleteMVPCallMap(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can delete MVP call maps" };
    }

    await prisma.mVPCallMap.delete({
      where: { id },
    });

    revalidatePath("/dashboard/mvp-call-maps");

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Error deleting MVP call map:", error);
    return { data: null, error: "Failed to delete MVP call map" };
  }
}

// ============================================
// MVP SHARED QUOTES
// ============================================

interface MVPMilestone {
  id: string;
  name: string;
  lineItemCodes: string[];
  amount: number;
}

interface MVPProductSummary {
  pages: Array<{ name: string; description: string }>;
  apis: Array<{ name: string; description: string }>;
  customLogic: Array<{ name: string; description: string }>;
}

interface DiagramNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    name: string;
    description?: string;
    isAuthenticated?: boolean;
    apiUrl?: string;
  };
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
}

interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface CreateMVPSharedQuoteData {
  mvpCallMapId: string;
  companyName: string;
  contactName?: string;
  contactEmail?: string;
  productSummary: MVPProductSummary;
  diagramData: DiagramData;
  lineItems: Array<{
    code: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    description?: string;
  }>;
  milestones: MVPMilestone[];
  subtotal: number;
  discountAmount: number;
  total: number;
  deposit: number;
  balance: number;
  expiresAt: Date;
}

export async function createMVPSharedQuote(data: CreateMVPSharedQuoteData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can create MVP shared quotes" };
    }

    const sharedQuote = await prisma.mVPSharedQuote.create({
      data: {
        mvpCallMapId: data.mvpCallMapId,
        companyName: data.companyName,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        productSummary: data.productSummary as unknown as Prisma.InputJsonValue,
        diagramData: data.diagramData as unknown as Prisma.InputJsonValue,
        lineItems: data.lineItems as unknown as Prisma.InputJsonValue,
        milestones: data.milestones as unknown as Prisma.InputJsonValue,
        subtotal: data.subtotal,
        discountAmount: data.discountAmount,
        total: data.total,
        deposit: data.deposit,
        balance: data.balance,
        expiresAt: data.expiresAt,
      },
    });

    revalidatePath(`/dashboard/mvp-call-maps/${data.mvpCallMapId}`);

    return { data: sharedQuote, error: null };
  } catch (error) {
    console.error("Error creating MVP shared quote:", error);
    return { data: null, error: "Failed to create MVP shared quote" };
  }
}

export async function deleteMVPSharedQuote(id: string, mvpCallMapId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can delete MVP shared quotes" };
    }

    await prisma.mVPSharedQuote.delete({
      where: { id },
    });

    revalidatePath(`/dashboard/mvp-call-maps/${mvpCallMapId}`);

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Error deleting MVP shared quote:", error);
    return { data: null, error: "Failed to delete MVP shared quote" };
  }
}

export async function getMVPSharedQuoteByToken(token: string) {
  try {
    const quote = await prisma.mVPSharedQuote.findUnique({
      where: { token },
      include: {
        mvpCallMap: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!quote) {
      return { data: null, error: "Quote not found" };
    }

    // Increment view count
    await prisma.mVPSharedQuote.update({
      where: { id: quote.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    });

    return { data: quote, error: null };
  } catch (error) {
    console.error("Error fetching MVP shared quote:", error);
    return { data: null, error: "Failed to fetch quote" };
  }
}

// ============================================
// PRESENTATION ACTIONS
// ============================================

export async function createPresentation(data: {
  title: string;
  slides: unknown[];
}) {
  try {
    const presentation = await prisma.presentation.create({
      data: {
        title: data.title,
        slides: data.slides as never,
      },
    });
    return { data: presentation, error: null };
  } catch (error) {
    console.error("Error creating presentation:", error);
    return { data: null, error: "Failed to create presentation" };
  }
}

export async function updatePresentation(
  id: string,
  data: { title: string; slides: unknown[] }
) {
  try {
    const presentation = await prisma.presentation.update({
      where: { id },
      data: {
        title: data.title,
        slides: data.slides as never,
      },
    });
    return { data: presentation, error: null };
  } catch (error) {
    console.error("Error updating presentation:", error);
    return { data: null, error: "Failed to update presentation" };
  }
}

export async function deletePresentation(id: string) {
  try {
    await prisma.presentation.delete({ where: { id } });
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting presentation:", error);
    return { data: null, error: "Failed to delete presentation" };
  }
}

export async function splitScriptIntoLines(data: {
  script: string;
}): Promise<{ data: string | null; error: string | null }> {
  try {
    console.log("[Presentations] Sending script to AI for splitting into lines...");

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return { data: null, error: "OpenAI API key not configured" };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `You take a video script and add newlines to split it into short chunks that feel like spoken dialogue.

CRITICAL RULES:
- Keep the text EXACTLY verbatim. Do NOT rewrite, rephrase, summarize, or change ANY words.
- Your ONLY job is to insert newlines. Each line should be a few words -- like a beat in a conversation. One breath, one punch.
- Split at dramatic pauses, punchlines, reveals, and emotional beats.
- Aim for 3-8 words per line. Never leave a full paragraph on one line.
- Return ONLY the newlined text. No JSON, no numbering, no formatting -- just the raw text with newlines.

GOOD EXAMPLE:
Input: "So I built ReviveDeadLinks in just 7 days and it scans your entire website for broken links automatically"
Output:
So
I built ReviveDeadLinks
in just 7 days
and it scans your entire website
for broken links
automatically

BAD EXAMPLE (DO NOT DO THIS):
Input: "So I built ReviveDeadLinks in just 7 days"
Output: "So I built ReviveDeadLinks in just 7 days"
(no splitting -- WRONG)

BAD EXAMPLE (DO NOT DO THIS):
Input: "So I built ReviveDeadLinks in just 7 days"
Output: "I created ReviveDeadLinks in a week"
(rewritten -- WRONG, must be verbatim)

GOOD EXAMPLE:
Input: "Now that you have proof that I build functional, fast, reliable, responsive, beautiful products at incredible speed, the question is how?"
Output:
Now that you have proof
that I build
functional, fast, reliable, responsive, beautiful
products at incredible speed
the question is
how?`,
          },
          {
            role: "user",
            content: data.script,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Presentations] OpenAI API error:", response.status, errorText);
      return { data: null, error: `OpenAI API error (${response.status}): ${errorText}` };
    }

    const result = await response.json();
    console.log("[Presentations] OpenAI response finish_reason:", result.choices?.[0]?.finish_reason);

    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[Presentations] No content in response. Full response:", JSON.stringify(result, null, 2));
      return { data: null, error: "No content generated - the AI returned an empty response" };
    }

    console.log("[Presentations] AI split complete");
    return { data: content.trim(), error: null };
  } catch (error) {
    console.error("[Presentations] Error splitting script:", error);
    return { data: null, error: "Failed to split script" };
  }
}

// ============================================
// GOVERNMENT CONTRACTS (SAM.gov)
// ============================================

const GOV_STATUS_ORDER = [
  "SOURCES_SOUGHT",
  "GO_NO_GO",
  "POC_OUTREACH",
  "RESPONSE_DRAFTED",
  "RECEIPT_CONFIRMED",
  "FOLLOWUP_MEETING",
  "AWAITING_SOLICITATION",
  "SOLICITATION_RELEASED",
  "PROPOSAL_SUBMITTED",
  "PROPOSAL_RECEIPT_CONFIRMED",
  "MONITORING_AWARD",
  "WON",
  "LOST",
] as const;

export async function createGovContract(data: {
  title: string;
  agency: string;
  subAgency?: string;
  solicitationNumber?: string;
  naicsCode?: string;
  setAsideType?: "SMALL_BUSINESS" | "EIGHT_A" | "HUBZONE" | "SDVOSB" | "WOSB" | "FULL_AND_OPEN" | "OTHER";
  estimatedValue?: number;
  responseDeadline?: Date;
  placeOfPerformance?: string;
  description?: string;
  samGovUrl?: string;
  notes?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can create government contracts" };
    }

    console.log("[SAM.gov] Creating new contract:", data.title);

    const contract = await prisma.govContract.create({
      data: {
        title: data.title,
        agency: data.agency,
        subAgency: data.subAgency,
        solicitationNumber: data.solicitationNumber,
        naicsCode: data.naicsCode,
        setAsideType: data.setAsideType,
        estimatedValue: data.estimatedValue,
        responseDeadline: data.responseDeadline,
        placeOfPerformance: data.placeOfPerformance,
        description: data.description,
        samGovUrl: data.samGovUrl,
        notes: data.notes,
        status: "SOURCES_SOUGHT",
        activities: {
          create: {
            type: "STATUS_CHANGE",
            description: "Contract created and added to pipeline",
            newStatus: "SOURCES_SOUGHT",
          },
        },
      },
    });

    console.log("[SAM.gov] Contract created:", contract.id);
    revalidatePath("/dashboard/sam-gov");
    return { data: contract, error: null };
  } catch (error) {
    console.error("[SAM.gov] Error creating contract:", error);
    return { data: null, error: "Failed to create contract" };
  }
}

export async function updateGovContract(
  id: string,
  data: {
    title?: string;
    agency?: string;
    subAgency?: string | null;
    solicitationNumber?: string | null;
    naicsCode?: string | null;
    setAsideType?: "SMALL_BUSINESS" | "EIGHT_A" | "HUBZONE" | "SDVOSB" | "WOSB" | "FULL_AND_OPEN" | "OTHER" | null;
    estimatedValue?: number | null;
    awardAmount?: number | null;
    responseDeadline?: Date | null;
    expectedSolicitationDate?: Date | null;
    awardDate?: Date | null;
    performancePeriodStart?: Date | null;
    performancePeriodEnd?: Date | null;
    placeOfPerformance?: string | null;
    description?: string | null;
    samGovUrl?: string | null;
    notes?: string | null;
    goNoGoNotes?: string | null;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can update government contracts" };
    }

    console.log("[SAM.gov] Updating contract:", id);

    const contract = await prisma.govContract.update({
      where: { id },
      data,
    });

    console.log("[SAM.gov] Contract updated:", contract.id);
    revalidatePath("/dashboard/sam-gov");
    revalidatePath(`/dashboard/sam-gov/${id}`);
    return { data: contract, error: null };
  } catch (error) {
    console.error("[SAM.gov] Error updating contract:", error);
    return { data: null, error: "Failed to update contract" };
  }
}

export async function advanceGovContractStatus(
  id: string,
  expectedSolicitationDate?: Date
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can advance contract status" };
    }

    const contract = await prisma.govContract.findUnique({ where: { id } });
    if (!contract) {
      return { data: null, error: "Contract not found" };
    }

    const currentIndex = GOV_STATUS_ORDER.indexOf(contract.status);
    if (currentIndex === -1 || currentIndex >= GOV_STATUS_ORDER.length - 1) {
      return { data: null, error: "Cannot advance past final status" };
    }

    // WON is at index 11, LOST at 12 - if at MONITORING_AWARD (10), default advance goes to WON
    const nextStatus = GOV_STATUS_ORDER[currentIndex + 1];

    console.log("[SAM.gov] Advancing contract", id, "from", contract.status, "to", nextStatus);

    const updateData: Record<string, unknown> = {
      status: nextStatus,
    };

    if (nextStatus === "AWAITING_SOLICITATION" && expectedSolicitationDate) {
      updateData.expectedSolicitationDate = expectedSolicitationDate;
    }

    const updated = await prisma.govContract.update({
      where: { id },
      data: updateData,
    });

    await prisma.govContractActivity.create({
      data: {
        govContractId: id,
        type: "STATUS_CHANGE",
        description: `Status advanced from ${contract.status} to ${nextStatus}`,
        oldStatus: contract.status,
        newStatus: nextStatus,
      },
    });

    // Auto-create task when entering AWAITING_SOLICITATION
    if (nextStatus === "AWAITING_SOLICITATION" && expectedSolicitationDate) {
      console.log("[SAM.gov] Creating solicitation monitoring task");
      const dueDate = new Date(expectedSolicitationDate);
      dueDate.setDate(dueDate.getDate() - 7);

      const taskResult = await createTask({
        name: `Prepare for solicitation: ${contract.title}`,
        description: `Government contract solicitation expected on ${expectedSolicitationDate.toLocaleDateString()}. Prepare proposal materials and monitor SAM.gov for release.\n\nContract: ${contract.title}\nAgency: ${contract.agency}\nSolicitation #: ${contract.solicitationNumber || "TBD"}`,
        priority: "HIGH",
        status: "TODO",
        dueDate,
        clientCompanyId: JARO_DEV_INTERNAL_CLIENT_ID,
      });

      if (taskResult.data) {
        await prisma.govContract.update({
          where: { id },
          data: { linkedTaskId: taskResult.data.id },
        });

        await prisma.govContractActivity.create({
          data: {
            govContractId: id,
            type: "TASK_CREATED",
            description: `Auto-created task "Prepare for solicitation: ${contract.title}" due ${dueDate.toLocaleDateString()}`,
          },
        });
        console.log("[SAM.gov] Task created:", taskResult.data.id);
      }
    }

    console.log("[SAM.gov] Status advanced successfully");
    revalidatePath("/dashboard/sam-gov");
    revalidatePath(`/dashboard/sam-gov/${id}`);
    return { data: updated, error: null };
  } catch (error) {
    console.error("[SAM.gov] Error advancing status:", error);
    return { data: null, error: "Failed to advance contract status" };
  }
}

export async function setGovContractOutcome(
  id: string,
  outcome: "WON" | "LOST",
  awardAmount?: number,
  awardDate?: Date
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can set contract outcome" };
    }

    const contract = await prisma.govContract.findUnique({ where: { id } });
    if (!contract) {
      return { data: null, error: "Contract not found" };
    }

    console.log("[SAM.gov] Setting contract outcome:", id, outcome);

    const updated = await prisma.govContract.update({
      where: { id },
      data: {
        status: outcome,
        ...(awardAmount !== undefined && { awardAmount }),
        ...(awardDate && { awardDate }),
      },
    });

    await prisma.govContractActivity.create({
      data: {
        govContractId: id,
        type: "STATUS_CHANGE",
        description: outcome === "WON"
          ? `Contract AWARDED${awardAmount ? ` - $${awardAmount.toLocaleString()}` : ""}`
          : "Contract not awarded (LOST)",
        oldStatus: contract.status,
        newStatus: outcome,
      },
    });

    revalidatePath("/dashboard/sam-gov");
    revalidatePath(`/dashboard/sam-gov/${id}`);
    return { data: updated, error: null };
  } catch (error) {
    console.error("[SAM.gov] Error setting outcome:", error);
    return { data: null, error: "Failed to set contract outcome" };
  }
}

export async function revertGovContractStatus(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can revert contract status" };
    }

    const contract = await prisma.govContract.findUnique({ where: { id } });
    if (!contract) {
      return { data: null, error: "Contract not found" };
    }

    const currentIndex = GOV_STATUS_ORDER.indexOf(contract.status);
    if (currentIndex <= 0) {
      return { data: null, error: "Cannot revert past first status" };
    }

    const prevStatus = GOV_STATUS_ORDER[currentIndex - 1];

    console.log("[SAM.gov] Reverting contract", id, "from", contract.status, "to", prevStatus);

    const updated = await prisma.govContract.update({
      where: { id },
      data: { status: prevStatus },
    });

    await prisma.govContractActivity.create({
      data: {
        govContractId: id,
        type: "STATUS_CHANGE",
        description: `Status reverted from ${contract.status} to ${prevStatus}`,
        oldStatus: contract.status,
        newStatus: prevStatus,
      },
    });

    revalidatePath("/dashboard/sam-gov");
    revalidatePath(`/dashboard/sam-gov/${id}`);
    return { data: updated, error: null };
  } catch (error) {
    console.error("[SAM.gov] Error reverting status:", error);
    return { data: null, error: "Failed to revert contract status" };
  }
}

export async function deleteGovContract(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can delete government contracts" };
    }

    console.log("[SAM.gov] Deleting contract:", id);

    await prisma.govContract.delete({ where: { id } });

    revalidatePath("/dashboard/sam-gov");
    return { data: true, error: null };
  } catch (error) {
    console.error("[SAM.gov] Error deleting contract:", error);
    return { data: null, error: "Failed to delete contract" };
  }
}

export async function createGovContractContact(data: {
  govContractId: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  organization?: string;
  role: "CONTRACTING_OFFICER" | "PROGRAM_MANAGER" | "TECHNICAL_POC" | "SMALL_BUSINESS_REP" | "INTERNAL" | "OTHER";
  notes?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can add contacts" };
    }

    console.log("[SAM.gov] Adding contact to contract:", data.govContractId);

    const contact = await prisma.govContractContact.create({ data });

    await prisma.govContractActivity.create({
      data: {
        govContractId: data.govContractId,
        type: "CONTACT_ADDED",
        description: `Added contact: ${data.name} (${data.role})`,
      },
    });

    revalidatePath(`/dashboard/sam-gov/${data.govContractId}`);
    return { data: contact, error: null };
  } catch (error) {
    console.error("[SAM.gov] Error adding contact:", error);
    return { data: null, error: "Failed to add contact" };
  }
}

export async function updateGovContractContact(
  id: string,
  data: {
    name?: string;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
    organization?: string | null;
    role?: "CONTRACTING_OFFICER" | "PROGRAM_MANAGER" | "TECHNICAL_POC" | "SMALL_BUSINESS_REP" | "INTERNAL" | "OTHER";
    notes?: string | null;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can update contacts" };
    }

    console.log("[SAM.gov] Updating contact:", id);

    const contact = await prisma.govContractContact.update({
      where: { id },
      data,
    });

    revalidatePath(`/dashboard/sam-gov/${contact.govContractId}`);
    return { data: contact, error: null };
  } catch (error) {
    console.error("[SAM.gov] Error updating contact:", error);
    return { data: null, error: "Failed to update contact" };
  }
}

export async function deleteGovContractContact(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can delete contacts" };
    }

    console.log("[SAM.gov] Deleting contact:", id);

    const contact = await prisma.govContractContact.delete({ where: { id } });

    revalidatePath(`/dashboard/sam-gov/${contact.govContractId}`);
    return { data: true, error: null };
  } catch (error) {
    console.error("[SAM.gov] Error deleting contact:", error);
    return { data: null, error: "Failed to delete contact" };
  }
}

export async function addGovContractNote(govContractId: string, description: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can add notes" };
    }

    console.log("[SAM.gov] Adding note to contract:", govContractId);

    const activity = await prisma.govContractActivity.create({
      data: {
        govContractId,
        type: "NOTE",
        description,
      },
    });

    revalidatePath(`/dashboard/sam-gov/${govContractId}`);
    return { data: activity, error: null };
  } catch (error) {
    console.error("[SAM.gov] Error adding note:", error);
    return { data: null, error: "Failed to add note" };
  }
}

export async function saveGovContractDocument(
  id: string,
  documentType: "callScript" | "sourcesResponseContent" | "proposalContent" | "goNoGoNotes",
  content: string
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return { data: null, error: "Only admins can save documents" };
    }

    console.log("[SAM.gov] Saving document type:", documentType, "for contract:", id);

    const docLabels: Record<string, string> = {
      callScript: "Call Script",
      sourcesResponseContent: "Sources Sought Response",
      proposalContent: "Proposal",
      goNoGoNotes: "Go/No-Go Analysis",
    };

    const updated = await prisma.govContract.update({
      where: { id },
      data: { [documentType]: content },
    });

    await prisma.govContractActivity.create({
      data: {
        govContractId: id,
        type: "DOCUMENT_GENERATED",
        description: `Generated document: ${docLabels[documentType] || documentType}`,
      },
    });

    revalidatePath(`/dashboard/sam-gov/${id}`);
    return { data: updated, error: null };
  } catch (error) {
    console.error("[SAM.gov] Error saving document:", error);
    return { data: null, error: "Failed to save document" };
  }
}

// ============================================
// GOVERNMENT MARKET RESEARCH ACTIONS
// ============================================

export async function syncSamOpportunities(fullSync: boolean = false) {
  "use server";
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user || user.role !== "ADMIN") {
      return { data: null, error: "Only admins can trigger sync" };
    }

    const { runSamGovSync, getLastSuccessfulSync } = await import("@/lib/gov-sync");

    let sinceDate: Date | undefined;
    if (!fullSync) {
      const lastSync = await getLastSuccessfulSync("SAM_GOV");
      if (lastSync) {
        sinceDate = new Date(lastSync);
        sinceDate.setDate(sinceDate.getDate() - 1);
        console.log(`[Market Research] Incremental SAM.gov sync since ${sinceDate.toISOString()}`);
      }
    }

    console.log(`[Market Research] Triggering SAM.gov ${fullSync ? "full" : "incremental"} sync...`);

    const result = await runSamGovSync({ sinceDate });

    if (!result.success) {
      return { data: null, error: result.error || "Sync failed" };
    }

    console.log("[Market Research] SAM.gov sync completed:", result);

    revalidatePath("/dashboard/sam-gov/opportunities");
    revalidatePath("/dashboard/sam-gov/market-research");
    return { data: result, error: null };
  } catch (error) {
    console.error("[Market Research] Error syncing SAM.gov:", error);
    return { data: null, error: "Failed to sync SAM.gov opportunities" };
  }
}

export async function syncUsaSpending(fullSync: boolean = false) {
  "use server";
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user || user.role !== "ADMIN") {
      return { data: null, error: "Only admins can trigger sync" };
    }

    console.log(`[Market Research] Triggering USASpending ${fullSync ? "full" : "incremental"} sync...`);

    const { runUsaSpendingSync } = await import("@/lib/gov-sync");
    const result = await runUsaSpendingSync({
      currentFiscalYearOnly: !fullSync,
    });

    if (!result.success) {
      return { data: null, error: result.error || "Sync failed" };
    }

    console.log("[Market Research] USASpending sync completed:", result);

    revalidatePath("/dashboard/sam-gov/market-research");
    return { data: result, error: null };
  } catch (error) {
    console.error("[Market Research] Error syncing USASpending:", error);
    return { data: null, error: "Failed to sync USASpending data" };
  }
}

export async function importOpportunityToContract(opportunityId: string) {
  "use server";
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user || user.role !== "ADMIN") {
      return { data: null, error: "Only admins can import opportunities" };
    }

    console.log("[Market Research] Importing opportunity to pipeline:", opportunityId);

    const opportunity = await prisma.govOpportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) {
      return { data: null, error: "Opportunity not found" };
    }

    if (opportunity.isImported) {
      return { data: null, error: "Opportunity already imported" };
    }

    console.log("[Market Research] Creating GovContract from opportunity:", opportunity.title);

    const mapSetAside = (setAside: string | null) => {
      if (!setAside) return null;
      const lower = setAside.toLowerCase();
      if (lower.includes("small business")) return "SMALL_BUSINESS" as const;
      if (lower.includes("8(a)") || lower.includes("8a")) return "EIGHT_A" as const;
      if (lower.includes("hubzone")) return "HUBZONE" as const;
      if (lower.includes("sdvosb") || lower.includes("service-disabled")) return "SDVOSB" as const;
      if (lower.includes("wosb") || lower.includes("women")) return "WOSB" as const;
      if (lower.includes("full and open")) return "FULL_AND_OPEN" as const;
      return "OTHER" as const;
    };

    const contract = await prisma.govContract.create({
      data: {
        title: opportunity.title,
        solicitationNumber: opportunity.solicitationNumber,
        agency: opportunity.agency,
        subAgency: opportunity.subAgency,
        naicsCode: opportunity.naicsCode,
        setAsideType: mapSetAside(opportunity.setAsideType),
        status: "SOURCES_SOUGHT",
        estimatedValue: opportunity.estimatedValue,
        responseDeadline: opportunity.responseDeadline,
        placeOfPerformance: opportunity.placeOfPerformance,
        description: opportunity.description,
        samGovUrl: opportunity.samGovUrl,
        activities: {
          create: {
            type: "STATUS_CHANGE",
            description: `Imported from SAM.gov opportunity (Notice ID: ${opportunity.noticeId})`,
            newStatus: "SOURCES_SOUGHT",
          },
        },
      },
    });

    console.log("[Market Research] Created contract, updating opportunity as imported...");

    await prisma.govOpportunity.update({
      where: { id: opportunityId },
      data: {
        isImported: true,
        importedContractId: contract.id,
      },
    });

    revalidatePath("/dashboard/sam-gov");
    revalidatePath("/dashboard/sam-gov/opportunities");
    return { data: contract, error: null };
  } catch (error) {
    console.error("[Market Research] Error importing opportunity:", error);
    return { data: null, error: "Failed to import opportunity" };
  }
}

export async function dismissOpportunity(opportunityId: string) {
  "use server";
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user || user.role !== "ADMIN") {
      return { data: null, error: "Only admins can dismiss opportunities" };
    }

    console.log("[Market Research] Dismissing opportunity:", opportunityId);

    const updated = await prisma.govOpportunity.update({
      where: { id: opportunityId },
      data: { isDismissed: true },
    });

    revalidatePath("/dashboard/sam-gov/opportunities");
    return { data: updated, error: null };
  } catch (error) {
    console.error("[Market Research] Error dismissing opportunity:", error);
    return { data: null, error: "Failed to dismiss opportunity" };
  }
}

export async function undismissOpportunity(opportunityId: string) {
  "use server";
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user || user.role !== "ADMIN") {
      return { data: null, error: "Only admins can manage opportunities" };
    }

    const updated = await prisma.govOpportunity.update({
      where: { id: opportunityId },
      data: { isDismissed: false },
    });

    revalidatePath("/dashboard/sam-gov/opportunities");
    return { data: updated, error: null };
  } catch (error) {
    console.error("[Market Research] Error undismissing opportunity:", error);
    return { data: null, error: "Failed to restore opportunity" };
  }
}

export async function reanalyzeOpportunity(opportunityId: string) {
  "use server";
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user || user.role !== "ADMIN") {
      return { data: null, error: "Only admins can analyze opportunities" };
    }

    console.log("[Reanalyze] Fetching opportunity for analysis:", opportunityId);

    const opportunity = await prisma.govOpportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) {
      return { data: null, error: "Opportunity not found" };
    }

    console.log("[Reanalyze] Running AI analysis...");

    const { analyzeOpportunity } = await import("@/lib/gov-analysis");
    const result = await analyzeOpportunity(opportunity);

    if (result.error) {
      return { data: null, error: result.error };
    }

    console.log("[Reanalyze] Fetching updated analysis from database...");

    const analysis = await prisma.govOpportunityAnalysis.findUnique({
      where: { opportunityId },
    });

    revalidatePath("/dashboard/sam-gov/opportunities");
    return { data: analysis, error: null };
  } catch (error) {
    console.error("[Reanalyze] Error analyzing opportunity:", error);
    return { data: null, error: "Failed to analyze opportunity" };
  }
}
