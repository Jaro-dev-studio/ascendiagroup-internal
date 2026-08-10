import { NextRequest, NextResponse } from "next/server";
import { reportOpsFailure, toErrorMessage } from "@/lib/ops-alerts";

/**
 * Shared plumbing for scheduled routes: secret check, run logging, and failure
 * reporting to the operations Slack channel.
 *
 * Crons run unattended, so a job that throws or that quietly drops items has to
 * announce itself. Wrapping the handler keeps that reporting identical across
 * every job instead of eleven near-copies.
 */

export interface CronResult<T> {
  data: T | null;
  error: string | null;
  /**
   * Items that failed inside a run that otherwise completed. Reported as a
   * warning, and the response still succeeds.
   */
  failures?: string[];
}

type CronHandler<T> = (request: NextRequest) => Promise<CronResult<T>>;

/**
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on scheduled invocations
 * whenever the variable is set on the project. Requests are only refused when a
 * secret exists, so local runs and preview deployments without one still work.
 */
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export function createCronRoute<T>(name: string, handler: CronHandler<T>) {
  const log = `[Cron: ${name}]`;
  const source = `Cron: ${name}`;

  return async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
      console.warn(`${log} refused a request with a missing or wrong secret`);
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const startedAt = Date.now();
    console.log(`${log} starting...`);

    try {
      const result = await handler(request);
      const durationMs = Date.now() - startedAt;

      if (result.error) {
        console.error(`${log} failed: ${result.error}`);
        await reportOpsFailure({
          source,
          summary: "Scheduled run failed",
          error: result.error,
          context: { duration: `${Math.round(durationMs / 1000)}s` },
        });

        return NextResponse.json(
          { data: null, error: result.error },
          { status: 500 }
        );
      }

      if (result.failures && result.failures.length > 0) {
        console.warn(
          `${log} finished with ${result.failures.length} failed item(s)`
        );
        await reportOpsFailure({
          source,
          severity: "WARNING",
          summary: `Run completed with ${result.failures.length} failed item(s)`,
          details: result.failures,
          context: { duration: `${Math.round(durationMs / 1000)}s` },
        });
      }

      console.log(`${log} finished in ${Math.round(durationMs / 1000)}s`);

      return NextResponse.json({ data: result.data, error: null });
    } catch (error) {
      const message = toErrorMessage(error);
      console.error(`${log} threw:`, message);

      await reportOpsFailure({
        source,
        summary: "Scheduled run threw an unhandled error",
        error,
        context: {
          duration: `${Math.round((Date.now() - startedAt) / 1000)}s`,
        },
      });

      return NextResponse.json(
        { data: null, error: `Cron job failed: ${message}` },
        { status: 500 }
      );
    }
  };
}
