import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import {
  updateMetaAdSetBudget,
  updateMetaAdSetBudgets,
  type AdSetBudgetType,
} from "@/lib/integrations/meta";
import { reportOpsFailure } from "@/lib/ops-alerts";

export const maxDuration = 300;

const VALID_BUDGET_TYPES: AdSetBudgetType[] = ["daily", "lifetime"];

export async function POST(request: NextRequest) {
  try {
    console.log("[Ads AdSet Budget] authenticating session…");
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { adSetId, adSetIds, budgetType, amount } = body;

    console.log("[Ads AdSet Budget] validating request…", {
      adSetId,
      adSetIdsCount: Array.isArray(adSetIds) ? adSetIds.length : 0,
      budgetType,
      amount,
    });

    if (!budgetType || !VALID_BUDGET_TYPES.includes(budgetType)) {
      return NextResponse.json(
        { data: null, error: "Invalid or missing budgetType. Must be daily or lifetime." },
        { status: 400 }
      );
    }

    const parsedAmount = typeof amount === "number" ? amount : parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0 || Number.isNaN(parsedAmount)) {
      return NextResponse.json(
        { data: null, error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    // Bulk update
    if (Array.isArray(adSetIds) && adSetIds.length > 0) {
      console.log("[Ads AdSet Budget] bulk updating budgets…");
      const result = await updateMetaAdSetBudgets(adSetIds, budgetType, parsedAmount);
      if (result.error) {
        await reportOpsFailure({
          source: "Integration: Meta",
          summary: `Bulk ${budgetType} budget change failed for ${adSetIds.length} ad set(s)`,
          error: result.error,
          context: { amount: parsedAmount, adSets: adSetIds.length },
          url: "/dashboard/ads/my-ads",
        });

        return NextResponse.json(
          { data: null, error: result.error },
          { status: 500 }
        );
      }
      console.log("[Ads AdSet Budget] bulk update finished");
      return NextResponse.json({ data: result.data, error: null });
    }

    // Single update
    if (!adSetId || typeof adSetId !== "string") {
      return NextResponse.json(
        { data: null, error: "Missing required field: adSetId or adSetIds" },
        { status: 400 }
      );
    }

    console.log("[Ads AdSet Budget] updating single ad set budget…");
    const result = await updateMetaAdSetBudget(adSetId, budgetType, parsedAmount);

    if (result.error) {
      await reportOpsFailure({
        source: "Integration: Meta",
        summary: `Could not set the ${budgetType} budget on an ad set`,
        error: result.error,
        context: { adSetId, amount: parsedAmount },
        url: "/dashboard/ads/my-ads",
      });

      return NextResponse.json(
        { data: null, error: result.error },
        { status: 500 }
      );
    }

    console.log("[Ads AdSet Budget] update succeeded");
    return NextResponse.json({ data: result.data, error: null });
  } catch (error) {
    console.error("[Ads AdSet Budget] update error:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Failed to update ad set budget",
      },
      { status: 500 }
    );
  }
}
