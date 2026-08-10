import "server-only";

import { Prisma, type IntegrationProvider } from "@prisma/client";

import prisma from "@/lib/prisma";
import { decryptJson, encryptJson } from "@/lib/crypto";

export type IntegrationCredentials = Record<string, string>;

/** Env fallbacks so a deployment can boot with a key before anyone signs in. */
const ENV_FALLBACKS: Partial<Record<IntegrationProvider, IntegrationCredentials>> =
  {
    CLAUDE: process.env.ANTHROPIC_API_KEY
      ? { apiKey: process.env.ANTHROPIC_API_KEY }
      : undefined,
  };

export async function getIntegrationCredentials(
  provider: IntegrationProvider
): Promise<IntegrationCredentials | null> {
  const record = await prisma.integration.findUnique({ where: { provider } });
  const stored = decryptJson<IntegrationCredentials>(record?.credentials);

  if (stored && Object.keys(stored).length > 0) return stored;
  return ENV_FALLBACKS[provider] ?? null;
}

export async function saveIntegrationCredentials(
  provider: IntegrationProvider,
  credentials: IntegrationCredentials,
  options: {
    status: "CONNECTED" | "ERROR" | "DISCONNECTED";
    accountLabel?: string | null;
    lastError?: string | null;
    connectedById?: string | null;
    settings?: Prisma.InputJsonValue;
  }
) {
  const payload = {
    status: options.status,
    credentials: encryptJson(credentials),
    accountLabel: options.accountLabel ?? null,
    lastError: options.lastError ?? null,
    lastCheckedAt: new Date(),
    connectedById: options.connectedById ?? null,
    settings: options.settings ?? undefined,
  };

  return prisma.integration.upsert({
    where: { provider },
    create: { provider, ...payload },
    update: payload,
  });
}

export async function disconnectIntegration(provider: IntegrationProvider) {
  return prisma.integration.upsert({
    where: { provider },
    create: { provider, status: "DISCONNECTED" },
    update: {
      status: "DISCONNECTED",
      credentials: null,
      accountLabel: null,
      lastError: null,
      lastCheckedAt: new Date(),
    },
  });
}

export async function isIntegrationConnected(provider: IntegrationProvider) {
  const credentials = await getIntegrationCredentials(provider);
  return Boolean(credentials);
}
