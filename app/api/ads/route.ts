import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { fetchAllAds, fetchAllAdsWithPeriod, type TimePeriod } from "@/lib/integrations/meta";

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

    // Check for optional period parameter
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") as TimePeriod | null;
    
    // Validate period if provided
    const validPeriods: TimePeriod[] = ["24h", "7d", "30d", "3m", "1y"];
    if (period && !validPeriods.includes(period)) {
      return NextResponse.json(
        { data: null, error: "Invalid time period" },
        { status: 400 }
      );
    }

    // Fetch ads from Meta API (with period or all-time)
    const result = period 
      ? await fetchAllAdsWithPeriod(period)
      : await fetchAllAds();

    if (result.error) {
      return NextResponse.json(
        { data: null, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: result.data,
      error: null,
    });
  } catch (error) {
    console.error("[API] ads error:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Failed to fetch ads",
      },
      { status: 500 }
    );
  }
}
