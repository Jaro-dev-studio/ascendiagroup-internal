import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET endpoint to fetch demo status for polling
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const demo = await prisma.demo.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        vercelDeployUrl: true,
        githubRepoUrl: true,
        errorMessage: true,
      },
    });

    if (!demo) {
      return NextResponse.json(
        { data: null, error: "Demo not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: demo,
      error: null,
    });
  } catch (error) {
    console.error("[API] Get demo error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to fetch demo" },
      { status: 500 }
    );
  }
}
