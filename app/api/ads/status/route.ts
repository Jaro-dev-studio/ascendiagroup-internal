import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { updateMetaEntityStatus } from "@/lib/integrations/meta";
import { reportOpsFailure } from "@/lib/ops-alerts";

const VALID_ENTITY_TYPES = ["ad", "adset", "campaign"] as const;
const VALID_STATUSES = ["ACTIVE", "PAUSED"] as const;

export async function POST(request: NextRequest) {
  try {
    console.log("[Ads Status] authenticating session…");
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entityType, entityId, status } = body;

    console.log("[Ads Status] validating request body…", { entityType, entityId, status });

    if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
      return NextResponse.json(
        { data: null, error: "Invalid or missing entityType. Must be ad, adset, or campaign." },
        { status: 400 }
      );
    }

    if (!entityId || typeof entityId !== "string") {
      return NextResponse.json(
        { data: null, error: "Missing required field: entityId" },
        { status: 400 }
      );
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { data: null, error: "Invalid or missing status. Must be ACTIVE or PAUSED." },
        { status: 400 }
      );
    }

    console.log("[Ads Status] updating Meta entity status…");
    const result = await updateMetaEntityStatus(entityId, status);

    if (result.error) {
      // A status change that silently fails leaves live spend running
      await reportOpsFailure({
        source: "Integration: Meta",
        summary: `Could not set ${entityType} status to ${status}`,
        error: result.error,
        context: { entityType, entityId, status },
        url: "/dashboard/ads/my-ads",
      });

      return NextResponse.json(
        { data: null, error: result.error },
        { status: 500 }
      );
    }

    console.log("[Ads Status] status update succeeded");
    return NextResponse.json({
      data: result.data,
      error: null,
    });
  } catch (error) {
    console.error("[Ads Status] update error:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Failed to update status",
      },
      { status: 500 }
    );
  }
}
