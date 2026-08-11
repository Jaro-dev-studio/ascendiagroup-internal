"use server";

import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import type { IntegrationProvider } from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { getIntegrationDefinition } from "@/config/integrations";
import {
  disconnectIntegration,
  getIntegrationCredentials,
  saveIntegrationCredentials,
} from "@/lib/integrations/store";
import { testIntegrationConnection } from "@/lib/integrations/test-connection";

export async function connectIntegration(input: {
  provider: string;
  credentials: Record<string, string>;
}): Promise<{
  data: { status: string; message: string; accountLabel?: string } | null;
  error: string | null;
}> {
  try {
    const user = await requireAdmin();
    const provider = input.provider as IntegrationProvider;
    const definition = getIntegrationDefinition(provider);

    if (!definition) return { data: null, error: "Unknown integration." };

    console.log(`[Integrations] connecting ${provider}...`);

    const missing = definition.fields
      .filter((field) => field.required && !input.credentials[field.key]?.trim())
      .map((field) => field.label);

    if (missing.length > 0) {
      return { data: null, error: `Missing: ${missing.join(", ")}` };
    }

    const credentials = { ...input.credentials };

    // Webhook driven providers need a shared secret the sender can present.
    if (provider === "CALL_RECORDING" && !credentials.webhookToken) {
      const existing = await getIntegrationCredentials(provider);
      credentials.webhookToken = existing?.webhookToken ?? createId();
    }

    const result = await testIntegrationConnection(provider, credentials);

    await saveIntegrationCredentials(provider, credentials, {
      status: result.ok ? "CONNECTED" : "ERROR",
      accountLabel: result.accountLabel ?? null,
      lastError: result.ok ? null : result.message,
      connectedById: user.id,
    });

    await prisma.activityLog.create({
      data: {
        actorId: user.id,
        type: "INTEGRATION_UPDATED",
        title: `${definition.name} ${result.ok ? "connected" : "connection failed"}`,
        description: result.message,
        link: "/dashboard/integrations",
      },
    });

    revalidatePath("/dashboard/integrations");

    if (!result.ok) {
      return { data: null, error: result.message };
    }

    return {
      data: {
        status: "CONNECTED",
        message: result.message,
        accountLabel: result.accountLabel,
      },
      error: null,
    };
  } catch (error) {
    console.error("[Integrations] connection failed", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Could not save the integration.",
    };
  }
}

export async function retestIntegration(
  provider: string
): Promise<{ data: { message: string } | null; error: string | null }> {
  try {
    const user = await requireAdmin();
    const typed = provider as IntegrationProvider;
    console.log(`[Integrations] retesting ${provider}...`);

    const credentials = await getIntegrationCredentials(typed);
    if (!credentials) {
      return { data: null, error: "This integration is not connected yet." };
    }

    const result = await testIntegrationConnection(typed, credentials);

    await saveIntegrationCredentials(typed, credentials, {
      status: result.ok ? "CONNECTED" : "ERROR",
      accountLabel: result.accountLabel ?? null,
      lastError: result.ok ? null : result.message,
      connectedById: user.id,
    });

    revalidatePath("/dashboard/integrations");

    if (!result.ok) return { data: null, error: result.message };
    return { data: { message: result.message }, error: null };
  } catch (error) {
    console.error("[Integrations] retest failed", error);
    return { data: null, error: "Could not test the connection." };
  }
}

export async function removeIntegration(
  provider: string
): Promise<{ data: { provider: string } | null; error: string | null }> {
  try {
    await requireAdmin();
    console.log(`[Integrations] disconnecting ${provider}...`);

    await disconnectIntegration(provider as IntegrationProvider);
    revalidatePath("/dashboard/integrations");
    return { data: { provider }, error: null };
  } catch (error) {
    console.error("[Integrations] disconnect failed", error);
    return { data: null, error: "Could not disconnect the integration." };
  }
}
