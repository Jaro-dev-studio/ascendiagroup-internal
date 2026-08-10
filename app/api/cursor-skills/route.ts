import { NextRequest, NextResponse } from "next/server";
import {
  discoverWorkspaces,
  exportConversations,
  generateSkills,
} from "@/lib/cursor-skills";

/**
 * GET /api/cursor-skills
 *
 * Query params:
 *   action   - "discover" (default) | "export"
 *   filter   - text filter for discover (optional)
 *   workspace - workspace ID, name, or "latest" (required for export)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "discover";
    const filter = searchParams.get("filter") || undefined;
    const workspace = searchParams.get("workspace") || undefined;

    if (action === "discover") {
      const workspaces = discoverWorkspaces(filter);
      return NextResponse.json({ data: workspaces, error: null });
    }

    if (action === "export") {
      if (!workspace) {
        return NextResponse.json(
          { data: null, error: "workspace query parameter is required for export" },
          { status: 400 }
        );
      }
      const result = exportConversations(workspace);
      return NextResponse.json({ data: result, error: null });
    }

    return NextResponse.json(
      { data: null, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Cursor Skills] GET error:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cursor-skills
 *
 * Body:
 *   workspace    - workspace ID, name, or "latest" (required)
 *   minMessages  - minimum messages to consider substantive (default: 4)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace, minMessages = 4 } = body as {
      workspace?: string;
      minMessages?: number;
    };

    if (!workspace) {
      return NextResponse.json(
        { data: null, error: "workspace is required in request body" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          data: null,
          error:
            "ANTHROPIC_API_KEY environment variable is not set. Add it to your .env file.",
        },
        { status: 500 }
      );
    }

    const result = await generateSkills(workspace, apiKey, minMessages);
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error("[Cursor Skills] POST error:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
