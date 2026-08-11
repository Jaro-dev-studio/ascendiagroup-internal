import "server-only";

import prisma from "@/lib/prisma";
import { INTEGRATIONS } from "@/config/integrations";
import { decryptJson, maskSecret } from "@/lib/crypto";

export interface IntegrationSummary {
  provider: string;
  status: string;
  accountLabel: string | null;
  lastError: string | null;
  lastCheckedAt: Date | null;
  /** Masked so the UI can show what is stored without leaking the secret. */
  maskedValues: Record<string, string>;
  webhookToken: string | null;
}

export async function listIntegrations() {
  try {
    console.log("[Integrations] loading connection status...");

    const records = await prisma.integration.findMany();
    const byProvider = new Map(records.map((record) => [record.provider, record]));

    const summaries: IntegrationSummary[] = INTEGRATIONS.map((definition) => {
      const record = byProvider.get(definition.provider);
      const credentials = decryptJson<Record<string, string>>(record?.credentials);

      const maskedValues: Record<string, string> = {};
      for (const field of definition.fields) {
        const value = credentials?.[field.key];
        if (!value) continue;
        maskedValues[field.key] =
          field.type === "text" ? value : maskSecret(value);
      }

      return {
        provider: definition.provider,
        status: record?.status ?? "DISCONNECTED",
        accountLabel: record?.accountLabel ?? null,
        lastError: record?.lastError ?? null,
        lastCheckedAt: record?.lastCheckedAt ?? null,
        maskedValues,
        webhookToken: credentials?.webhookToken ?? null,
      };
    });

    return { data: summaries, error: null };
  } catch (error) {
    console.error("[Integrations] failed to load", error);
    return { data: null, error: "Could not load integrations." };
  }
}
