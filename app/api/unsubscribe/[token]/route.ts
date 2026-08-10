import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/crm/sequences/render";
import { addSuppression } from "@/lib/crm/sequences/suppression";

/**
 * One-click unsubscribe. Gmail and Outlook issue a POST for
 * List-Unsubscribe-Post, while a human clicking the footer link issues a GET,
 * so both verbs are handled and both are idempotent.
 */

function page(title: string, body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:#fafafa; color:#1c1c1c; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:24px; }
  .card { background:#fff; border:1px solid #e5e5e5; border-radius:12px; padding:32px; max-width:420px; text-align:center; }
  h1 { font-size:20px; margin:0 0 8px; }
  p { font-size:14px; line-height:1.5; color:#6b6b6b; margin:0; }
</style>
</head>
<body><div class="card"><h1>${title}</h1><p>${body}</p></div></body>
</html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function unsubscribe(token: string): Promise<{
  ok: boolean;
  email: string | null;
}> {
  const email = verifyUnsubscribeToken(token);

  if (!email) {
    console.warn("[Unsubscribe] rejected an invalid token");
    return { ok: false, email: null };
  }

  console.log(`[Unsubscribe] processing unsubscribe for ${email}...`);

  const result = await addSuppression(email, "unsubscribed");
  if (result.error) return { ok: false, email };

  const stopped = await prisma.sequenceEnrollment.updateMany({
    where: {
      person: { email },
      status: { in: ["ACTIVE", "PAUSED"] },
    },
    data: {
      status: "UNSUBSCRIBED",
      stoppedReason: "Recipient unsubscribed",
      nextSendAt: null,
    },
  });

  console.log(
    `[Unsubscribe] ${email} suppressed, ${stopped.count} enrollment(s) stopped`
  );

  return { ok: true, email };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await unsubscribe(token);

  if (!result.ok) {
    return page(
      "Link is no longer valid",
      "We could not process this unsubscribe request. Reply to any of our emails and we will remove you straight away.",
      400
    );
  }

  return page(
    "You have been unsubscribed",
    `${result.email} will not receive any further emails from us.`
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await unsubscribe(token);

  return NextResponse.json(
    { data: result.ok ? { unsubscribed: true } : null, error: result.ok ? null : "Invalid token" },
    { status: result.ok ? 200 : 400 }
  );
}
