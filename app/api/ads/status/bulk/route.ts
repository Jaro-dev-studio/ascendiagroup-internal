import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { updateMetaEntitiesStatus } from "@/lib/integrations/meta";
import { reportOpsFailure } from "@/lib/ops-alerts";

export const maxDuration = 300;

const VALID_ENTITY_TYPES = ["ad", "adset", "campaign"] as const;
const VALID_STATUSES = ["ACTIVE", "PAUSED"] as const;

export async function POST(request: NextRequest) {
  try {
    console.log("[Ads Status Bulk] authenticating session…");
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entities, status } = body;

    console.log("[Ads Status Bulk] validating request body…", {
      entityCount: Array.isArray(entities) ? entities.length : 0,
      status,
    });

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { data: null, error: "Invalid or missing status. Must be ACTIVE or PAUSED." },
        { status: 400 }
      );
    }

    if (!Array.isArray(entities) || entities.length === 0) {
      return NextResponse.json(
        { data: null, error: "Missing or empty entities array" },
        { status: 400 }
      );
    }

    for (const entity of entities) {
      if (!entity?.entityType || !VALID_ENTITY_TYPES.includes(entity.entityType)) {
        return NextResponse.json(
          { data: null, error: "Each entity must have entityType of ad, adset, or campaign." },
          { status: 400 }
        );
      }
      if (!entity?.entityId || typeof entity.entityId !== "string") {
        return NextResponse.json(
          { data: null, error: "Each entity must have a valid entityId string." },
          { status: 400 }
        );
      }
    }

    console.log("[Ads Status Bulk] updating Meta entities…");
    const result = await updateMetaEntitiesStatus(entities, status);

    if (result.error) {
      await reportOpsFailure({
        source: "Integration: Meta",
        summary: `Bulk status change to ${status} failed for ${entities.length} entity/entities`,
        error: result.error,
        context: { status, entities: entities.length },
        url: "/dashboard/ads/my-ads",
      });

      return NextResponse.json(
        { data: null, error: result.error },
        { status: 500 }
      );
    }

    console.log("[Ads Status Bulk] bulk update finished");
    return NextResponse.json({
      data: result.data,
      error: null,
    });
  } catch (error) {
    console.error("[Ads Status Bulk] update error:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Failed to bulk update status",
      },
      { status: 500 }
    );
  }
}
