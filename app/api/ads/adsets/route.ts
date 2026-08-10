import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { fetchAdSets, createAdSet, fetchAdSetAdCount } from "@/lib/integrations/meta";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const campaignId = searchParams.get("campaignId");
    const adSetId = searchParams.get("adSetId");
    const getAdCount = searchParams.get("getAdCount");

    // If requesting ad count for a specific ad set
    if (adSetId && getAdCount === "true") {
      const result = await fetchAdSetAdCount(adSetId);

      if (result.error) {
        return NextResponse.json(
          { data: null, error: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({
        data: { adCount: result.data },
        error: null,
      });
    }

    // Otherwise, fetch ad sets for a campaign
    if (!campaignId) {
      return NextResponse.json(
        { data: null, error: "campaignId is required" },
        { status: 400 }
      );
    }

    const result = await fetchAdSets(campaignId);

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
    console.error("[API] adsets error:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Failed to fetch ad sets",
      },
      { status: 500 }
    );
  }
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
    const { campaignId, name, sourceAdSetId } = body;

    if (!campaignId || !name || !sourceAdSetId) {
      return NextResponse.json(
        { data: null, error: "campaignId, name, and sourceAdSetId are required" },
        { status: 400 }
      );
    }

    const result = await createAdSet({
      campaignId,
      name,
      sourceAdSetId,
    });

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
    console.error("[API] create adset error:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Failed to create ad set",
      },
      { status: 500 }
    );
  }
}
