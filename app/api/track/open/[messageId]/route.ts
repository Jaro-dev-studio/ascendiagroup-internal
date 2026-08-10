import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

function pixelResponse(): NextResponse {
  return new NextResponse(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      // Caching would hide every open after the first
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    },
  });
}

/**
 * Records an email open. Always returns the pixel, even on an unknown id, so a
 * tracking failure never shows a broken image in the recipient's client.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;

  try {
    const message = await prisma.sequenceMessage.findUnique({
      where: { id: messageId },
      select: { id: true, openedAt: true },
    });

    if (message) {
      console.log(`[Tracking] open recorded for message ${messageId}`);
      await prisma.sequenceMessage.update({
        where: { id: messageId },
        data: {
          openedAt: message.openedAt ?? new Date(),
          openCount: { increment: 1 },
        },
      });
    }
  } catch (error) {
    console.error(`[Tracking] failed to record open for ${messageId}:`, error);
  }

  return pixelResponse();
}
