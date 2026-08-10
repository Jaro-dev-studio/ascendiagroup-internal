import { NextRequest, NextResponse } from "next/server";
import { reportOpsFailure, toErrorMessage } from "@/lib/ops-alerts";

/**
 * Wraps a webhook handler so an unhandled error reaches the operations Slack
 * channel instead of only the request log.
 *
 * Providers retry on a non-2xx, so the 500 is preserved; the alert exists
 * because a webhook that fails every retry otherwise silently drops the event.
 */
export function withWebhookAlerts(
  name: string,
  handler: (request: NextRequest) => Promise<Response>
) {
  const source = `Webhook: ${name}`;

  return async function POST(request: NextRequest): Promise<Response> {
    try {
      return await handler(request);
    } catch (error) {
      console.error(`[${source}] threw:`, toErrorMessage(error));

      await reportOpsFailure({
        source,
        summary: "Webhook handler threw an unhandled error",
        error,
      });

      return NextResponse.json(
        { data: null, error: "Webhook handler failed" },
        { status: 500 }
      );
    }
  };
}
