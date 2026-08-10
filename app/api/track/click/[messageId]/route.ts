import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function getFallbackUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://jaro.dev"
  ).replace(/\/$/, "");
}

/**
 * Records a click and redirects to the original link.
 *
 * Only http and https targets are followed, so a rewritten link can never be
 * turned into an open redirect to another scheme.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const target = request.nextUrl.searchParams.get("url");

  let destination = getFallbackUrl();

  if (target) {
    try {
      const parsed = new URL(target);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        destination = parsed.toString();
      }
    } catch {
      console.warn(`[Tracking] discarding malformed click target: ${target}`);
    }
  }

  try {
    const message = await prisma.sequenceMessage.findUnique({
      where: { id: messageId },
      select: { id: true, clickedAt: true },
    });

    if (message) {
      console.log(`[Tracking] click recorded for message ${messageId}`);
      await prisma.sequenceMessage.update({
        where: { id: messageId },
        data: {
          clickedAt: message.clickedAt ?? new Date(),
          clickCount: { increment: 1 },
          // A click proves the message was rendered, so count it as an open too
          openedAt: message.clickedAt ? undefined : new Date(),
        },
      });
    }
  } catch (error) {
    console.error(`[Tracking] failed to record click for ${messageId}:`, error);
  }

  return NextResponse.redirect(destination, { status: 302 });
}
