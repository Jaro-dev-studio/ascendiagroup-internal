import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import OpenAI from "openai";

export const maxDuration = 120;

const openai = new OpenAI();

/**
 * Fetch an image from URL and convert to base64 data URL
 */
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  
  const contentType = response.headers.get("content-type") || "image/png";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  
  return `data:${contentType};base64,${base64}`;
}

const AD_ANALYSIS_SYSTEM_PROMPT = `You are a potential customer browsing Instagram. You have NEVER heard of Jaro.dev or what they do. You know nothing about this company or its services.

You stumble upon this ad while scrolling. Analyze it exactly as a naive, first-time viewer would - with zero prior context.

Provide your genuine first impressions and thoughts on:

1. **First Impressions**: What catches your eye immediately? What details do you notice?

2. **Understanding**: Based solely on this ad, what do you think this is for? What product or service is being offered?

3. **Target Audience**: Who do you think this ad is meant for? Does it feel like it's speaking to you?

4. **The 5 W's**:
   - WHO is this from/for?
   - WHAT are they offering?
   - WHEN might someone need this?
   - WHERE would this service be delivered?
   - WHY should someone care?

5. **Creative Feedback**: Any thoughts on the visual design, copy, or overall presentation of the ad itself?

6. **Emotional Response**: How does this ad make you feel? Curious? Confused? Interested? Skeptical?

Be honest and direct. If something is unclear or confusing, say so.`;

const LANDING_PAGE_SYSTEM_PROMPT = `Continue from your perspective as the same potential customer who just saw that ad. You've now clicked on the ad and landed on this page.

Provide your continued thoughts and reactions:

1. **First Impressions of the Page**: Does this page match your expectations from the ad? Any surprises?

2. **Clarity**: What do you now understand about the product/service that you didn't before? Is the value proposition clear?

3. **Trust Signals**: Do you trust this company? What makes you feel confident or hesitant?

4. **Friction Points**: Is there anything confusing, unclear, or that makes you want to leave?

5. **Call to Action**: Is it clear what they want you to do next? Would you take that action?

6. **Overall Journey**: Rate the ad-to-landing-page experience. Did the story flow well from ad to page?

7. **Would You Convert?**: Based on everything you've seen, would you take the next step (fill out a form, book a call, etc.)? Why or why not?

Be specific and actionable with your feedback.`;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify user is admin or developer
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || user.role === "CLIENT") {
      return NextResponse.json(
        { data: null, error: "Access denied" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { metaAdId, metaAdName, adImageUrl, adBody, adHeadline, landingPageUrl } = body;

    // Validate required fields
    if (!metaAdId || !metaAdName || !adImageUrl || !landingPageUrl) {
      return NextResponse.json(
        { data: null, error: "Missing required fields: metaAdId, metaAdName, adImageUrl, landingPageUrl" },
        { status: 400 }
      );
    }

    // =========================================================================
    // Step 1: Analyze the Ad with Vision
    // =========================================================================
    console.log("[Funnel Diagnostic] Step 1: Analyzing ad creative...");

    // Convert ad image URL to base64
    console.log("[Funnel Diagnostic] Converting ad image to base64...");
    const adImageBase64 = await imageUrlToBase64(adImageUrl);

    const adUserMessage = adBody || adHeadline 
      ? `Here is an ad I saw on Instagram:\n\nHeadline: ${adHeadline || "N/A"}\nBody text: ${adBody || "N/A"}\n\n[See the ad creative image attached]`
      : "Here is an ad I saw on Instagram. [See the ad creative image attached]";

    // Use the Responses API for vision support
    const adAnalysisResponse = await openai.responses.create({
      model: "gpt-4.1",
      instructions: AD_ANALYSIS_SYSTEM_PROMPT,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: adUserMessage },
            { type: "input_image", image_url: adImageBase64, detail: "high" },
          ],
        },
      ],
    });

    const adAnalysis = adAnalysisResponse.output_text || "Unable to analyze ad.";

    // =========================================================================
    // Step 2: Scrape the Landing Page
    // =========================================================================
    console.log("[Funnel Diagnostic] Step 2: Scraping landing page...");

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const scrapeResponse = await fetch(`${baseUrl}/api/scrape-landing-page`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({ url: landingPageUrl }),
    });

    const scrapeResult = await scrapeResponse.json();

    if (scrapeResult.error) {
      console.error("[Funnel Diagnostic] Failed to scrape landing page:", scrapeResult.error);
      return NextResponse.json(
        { data: null, error: `Failed to scrape landing page: ${scrapeResult.error}` },
        { status: 500 }
      );
    }

    const { screenshotUrl, textContent, pageTitle } = scrapeResult.data;

    // =========================================================================
    // Step 3: Analyze the Landing Page (continuing conversation)
    // =========================================================================
    console.log("[Funnel Diagnostic] Step 3: Analyzing landing page...");

    // Convert screenshot URL to base64
    console.log("[Funnel Diagnostic] Converting screenshot to base64...");
    const screenshotBase64 = await imageUrlToBase64(screenshotUrl);

    const lpUserMessage = `I clicked on the ad and landed on this page: "${pageTitle}"

Here's a screenshot of the landing page, and some of the text content from the page:

---
${textContent.substring(0, 3000)}
---

[See the landing page screenshot attached]`;

    // Continue the conversation with context from the ad analysis
    const lpAnalysisResponse = await openai.responses.create({
      model: "gpt-4.1",
      instructions: LANDING_PAGE_SYSTEM_PROMPT,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: `Previously, I saw this ad and had these thoughts:\n\n${adAnalysis}\n\n---\n\nNow, ${lpUserMessage}` },
            { type: "input_image", image_url: screenshotBase64, detail: "high" },
          ],
        },
      ],
    });

    const landingPageAnalysis = lpAnalysisResponse.output_text || "Unable to analyze landing page.";

    // =========================================================================
    // Step 4: Save to Database
    // =========================================================================
    console.log("[Funnel Diagnostic] Step 4: Saving to database...");

    // Simplify conversation for JSON storage (use original URLs, not base64)
    const simplifiedConversation = [
      { role: "system", content: AD_ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: `${adUserMessage}\n[Image: ${adImageUrl}]` },
      { role: "assistant", content: adAnalysis },
      { role: "system", content: LANDING_PAGE_SYSTEM_PROMPT },
      { role: "user", content: `${lpUserMessage}\n[Image: ${screenshotUrl}]` },
      { role: "assistant", content: landingPageAnalysis },
    ];

    const diagnostic = await prisma.aiFunnelDiagnostic.create({
      data: {
        metaAdId,
        metaAdName,
        adImageUrl,
        adBody: adBody || null,
        adHeadline: adHeadline || null,
        landingPageUrl,
        landingPageScreenshot: screenshotUrl,
        landingPageContent: textContent,
        adAnalysis,
        landingPageAnalysis,
        fullConversation: simplifiedConversation,
      },
    });

    console.log("[Funnel Diagnostic] Completed successfully:", diagnostic.id);

    return NextResponse.json({
      data: {
        id: diagnostic.id,
        adAnalysis,
        landingPageAnalysis,
        landingPageScreenshot: screenshotUrl,
        landingPageContent: textContent,
      },
      error: null,
    });
  } catch (error) {
    console.error("[API] funnel-diagnostics error:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to run funnel diagnostic" },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch past diagnostics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || user.role === "CLIENT") {
      return NextResponse.json(
        { data: null, error: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const metaAdId = searchParams.get("metaAdId");
    const listAnalyzedIds = searchParams.get("listAnalyzedIds");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // If listAnalyzedIds is true, return just the set of analyzed metaAdIds
    if (listAnalyzedIds === "true") {
      const diagnostics = await prisma.aiFunnelDiagnostic.findMany({
        select: { metaAdId: true },
        distinct: ["metaAdId"],
      });
      
      const analyzedIds = diagnostics.map((d: { metaAdId: string }) => d.metaAdId);
      
      return NextResponse.json({
        data: analyzedIds,
        error: null,
      });
    }

    // If metaAdId is provided, fetch the most recent diagnostic for that ad
    if (metaAdId) {
      const diagnostic = await prisma.aiFunnelDiagnostic.findFirst({
        where: { metaAdId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          metaAdId: true,
          metaAdName: true,
          adImageUrl: true,
          landingPageUrl: true,
          landingPageScreenshot: true,
          landingPageContent: true,
          adAnalysis: true,
          landingPageAnalysis: true,
          createdAt: true,
        },
      });

      return NextResponse.json({
        data: diagnostic,
        error: null,
      });
    }

    // Otherwise, fetch recent diagnostics
    const diagnostics = await prisma.aiFunnelDiagnostic.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        metaAdId: true,
        metaAdName: true,
        adImageUrl: true,
        landingPageUrl: true,
        landingPageScreenshot: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      data: diagnostics,
      error: null,
    });
  } catch (error) {
    console.error("[API] funnel-diagnostics GET error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to fetch diagnostics" },
      { status: 500 }
    );
  }
}
