import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { createMetaAd, type CreateAdParams } from "@/lib/integrations/meta";

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
    const { campaignId, adSetId, name, imageUrl, storyImageUrl, primaryText, headline, description, linkUrl, urlParams, callToAction } = body;

    if (!campaignId || !adSetId || !name || !imageUrl || !primaryText || !headline || !linkUrl) {
      return NextResponse.json(
        { data: null, error: "Missing required fields: campaignId, adSetId, name, imageUrl, primaryText, headline, linkUrl" },
        { status: 400 }
      );
    }

    const params: CreateAdParams = {
      campaignId,
      adSetId,
      name,
      imageUrl,
      storyImageUrl,
      primaryText,
      headline,
      description,
      linkUrl,
      urlParams,
      callToAction,
    };

    const result = await createMetaAd(params);

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
    console.error("[API] create ad error:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Failed to create ad",
      },
      { status: 500 }
    );
  }
}
