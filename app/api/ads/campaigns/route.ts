import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { fetchCampaigns } from "@/lib/integrations/meta";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await fetchCampaigns();

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
    console.error("[API] campaigns error:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Failed to fetch campaigns",
      },
      { status: 500 }
    );
  }
}
