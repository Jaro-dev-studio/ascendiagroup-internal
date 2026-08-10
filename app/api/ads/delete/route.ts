import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { deleteMetaAd } from "@/lib/integrations/meta";

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
    const { adId } = body;

    if (!adId) {
      return NextResponse.json(
        { data: null, error: "Missing required field: adId" },
        { status: 400 }
      );
    }

    const result = await deleteMetaAd(adId);

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
    console.error("[API] delete ad error:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Failed to delete ad",
      },
      { status: 500 }
    );
  }
}
