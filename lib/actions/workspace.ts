"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";
import { createClientDriveFolder } from "@/lib/integrations/google-drive";
import { createTrelloBoard } from "@/lib/integrations/trello";
import { syncClientMetrics } from "@/lib/integrations/metrics";

export async function provisionDriveFolder(
  clientId: string
): Promise<{ data: { url: string } | null; error: string | null }> {
  try {
    await requireStaff();
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return { data: null, error: "Client not found." };

    console.log(`[Workspace] provisioning Drive folder for ${client.name}...`);
    const folder = await createClientDriveFolder(client.name);

    await prisma.client.update({
      where: { id: clientId },
      data: { driveFolderUrl: folder.url },
    });

    revalidatePath(`/dashboard/clients/${clientId}`);
    return { data: { url: folder.url }, error: null };
  } catch (error) {
    console.error("[Workspace] Drive provisioning failed", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Could not create the Drive folder.",
    };
  }
}

export async function provisionTrelloBoard(
  clientId: string
): Promise<{ data: { url: string } | null; error: string | null }> {
  try {
    await requireStaff();
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return { data: null, error: "Client not found." };

    console.log(`[Workspace] provisioning Trello board for ${client.name}...`);
    const board = await createTrelloBoard(`${client.name} — Delivery`);

    await prisma.client.update({
      where: { id: clientId },
      data: { trelloBoardId: board.id, trelloBoardUrl: board.url },
    });

    revalidatePath(`/dashboard/clients/${clientId}`);
    return { data: { url: board.url }, error: null };
  } catch (error) {
    console.error("[Workspace] Trello provisioning failed", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Could not create the Trello board.",
    };
  }
}

export async function refreshClientMetrics(
  clientId: string
): Promise<{ data: { count: number; errors: string[] } | null; error: string | null }> {
  try {
    await requireStaff();
    const result = await syncClientMetrics(clientId);

    revalidatePath(`/dashboard/clients/${clientId}`);
    revalidatePath("/dashboard/reporting");
    return { data: result, error: null };
  } catch (error) {
    console.error("[Reporting] metric refresh failed", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Could not refresh metrics.",
    };
  }
}
