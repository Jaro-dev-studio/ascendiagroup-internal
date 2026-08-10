import { NextRequest, NextResponse } from "next/server";
import { scrapeBrandFromDomain } from "@/lib/scraping/brand";

export const maxDuration = 120;

// HTTP endpoint for manual testing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain } = body;

    if (!domain || typeof domain !== "string") {
      return NextResponse.json({ data: null, error: "Domain is required" }, { status: 400 });
    }

    const brandInfo = await scrapeBrandFromDomain(domain);

    return NextResponse.json({
      data: brandInfo,
      error: null,
    });
  } catch (error) {
    console.error("[API] scrape-brand error:", error);

    const errorMessage = error instanceof Error ? error.message : "Failed to scrape brand";

    return NextResponse.json({ data: null, error: errorMessage }, { status: 500 });
  }
}
