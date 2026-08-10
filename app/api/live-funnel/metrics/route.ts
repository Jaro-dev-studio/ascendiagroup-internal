import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { fetchMetaAdInsightsWithBreakdown, type TimePeriod, type InsightsFilterOptions } from "@/lib/integrations/meta";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get time period from query params
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get("period") || "7d") as TimePeriod;
    const campaignId = searchParams.get("campaignId") || undefined;
    const adsetId = searchParams.get("adsetId") || undefined;

    // Validate period
    const validPeriods: TimePeriod[] = ["24h", "7d", "30d", "3m", "1y"];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { data: null, error: "Invalid time period" },
        { status: 400 }
      );
    }

    // Build filter options
    const filters: InsightsFilterOptions = {};
    if (campaignId) filters.campaignId = campaignId;
    if (adsetId) filters.adsetId = adsetId;

    // Fetch metrics from Meta API with breakdown (leads/calls are included in the response)
    const metaResult = await fetchMetaAdInsightsWithBreakdown(period, filters);

    if (metaResult.error || !metaResult.data) {
      return NextResponse.json({
        data: {
          meta: null,
          leads: 0,
          scheduleCalls: 0,
          metaError: metaResult.error,
          callsError: null,
          campaignBreakdown: [],
          adsetBreakdown: [],
        },
        error: null,
      });
    }

    return NextResponse.json({
      data: {
        meta: metaResult.data.metrics,
        leads: metaResult.data.metrics.leads,
        scheduleCalls: metaResult.data.metrics.scheduleCalls,
        metaError: null,
        callsError: null,
        campaignBreakdown: metaResult.data.campaignBreakdown,
        adsetBreakdown: metaResult.data.adsetBreakdown,
      },
      error: null,
    });
  } catch (error) {
    console.error("[API] live-funnel/metrics error:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Failed to fetch metrics",
      },
      { status: 500 }
    );
  }
}
