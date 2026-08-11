import "server-only";

/**
 * AgencyAnalytics exposes a single POST endpoint rather than REST resources.
 * Every call names the asset and operation in the body and authenticates with
 * Basic auth over an empty username and the API key as the password.
 */
const ENDPOINT = "https://apirequest.app/query";

export interface AgencyAnalyticsQuery {
  asset: string;
  operation: "read" | "create" | "update" | "delete";
  fields?: string[];
  connector_type?: string;
  campaign_id?: number | string;
  limit?: number;
  offset?: number;
}

export interface AgencyAnalyticsResponse {
  status: "success" | "error";
  code: number;
  results: Record<string, unknown>[];
  messages: string[];
}

export async function agencyAnalyticsQuery(
  apiKey: string,
  query: AgencyAnalyticsQuery
): Promise<AgencyAnalyticsResponse> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`:${apiKey}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ provider: "agency-analytics-v2", ...query }),
  });

  const payload = (await response.json()) as {
    status?: string;
    code?: number;
    results?: unknown;
  };

  // Errors put the detail under results.messages, successes return an array.
  const results = Array.isArray(payload.results)
    ? (payload.results as Record<string, unknown>[])
    : [];
  const messages =
    !Array.isArray(payload.results) &&
    payload.results &&
    Array.isArray((payload.results as { messages?: string[] }).messages)
      ? ((payload.results as { messages: string[] }).messages ?? [])
      : [];

  return {
    status: payload.status === "success" ? "success" : "error",
    code: payload.code ?? response.status,
    results,
    messages,
  };
}
