import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { put } from "@vercel/blob";
import { launchBrowser, SCRAPER_USER_AGENT } from "@/lib/scraping/browser";

export const maxDuration = 300;

interface ScrapeResult {
  screenshotUrl: string;
  textContent: string;
  pageTitle: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { data: null, error: "URL is required" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { data: null, error: "Invalid URL" },
        { status: 400 }
      );
    }

    const browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setUserAgent(SCRAPER_USER_AGENT);

    // Navigate to the URL
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait a bit for any lazy-loaded content
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get page title
    const pageTitle = await page.title();

    // Take a full-page screenshot
    const screenshotBuffer = await page.screenshot({
      type: "png",
      fullPage: true,
    });

    // Extract text content from the page
    const textContent = await page.evaluate(() => {
      // Remove script and style elements
      const scripts = document.querySelectorAll("script, style, noscript");
      scripts.forEach((el) => el.remove());

      // Get text content from body
      const body = document.body;
      if (!body) return "";

      // Extract text, cleaning up whitespace
      const text = body.innerText || body.textContent || "";
      return text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join("\n")
        .substring(0, 10000); // Limit to 10k chars
    });

    await browser.close();

    // Upload screenshot to Vercel Blob
    const timestamp = Date.now();
    const filename = `funnel-diagnostics/${timestamp}-screenshot.png`;

    // Convert to Blob for Vercel Blob storage
    const screenshotBlob = new Blob([screenshotBuffer as unknown as ArrayBuffer], { type: "image/png" });

    const blob = await put(filename, screenshotBlob, {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/png",
    });

    const result: ScrapeResult = {
      screenshotUrl: blob.url,
      textContent,
      pageTitle,
    };

    return NextResponse.json({
      data: result,
      error: null,
    });
  } catch (error) {
    console.error("[API] scrape-landing-page error:", error);
    
    // More specific error messages
    const errorMessage = error instanceof Error ? error.message : "Failed to scrape landing page";
    
    return NextResponse.json(
      { data: null, error: errorMessage },
      { status: 500 }
    );
  }
}
