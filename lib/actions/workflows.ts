"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { del } from "@vercel/blob";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { WorkflowTriggerType } from "@prisma/client";

interface ActionResult<T> {
  data: T | null;
  error: string | null;
}

async function getAdminUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

// ============================================================================
// Workflows
// ============================================================================

interface CreateWorkflowData {
  name: string;
  description?: string;
  triggerType: WorkflowTriggerType;
  triggerValue?: string;
  triggeredByWorkflowId?: string;
}

export async function createWorkflow(
  data: CreateWorkflowData
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    console.log("[Workflows] Creating workflow:", data.name);

    const workflow = await prisma.workflow.create({
      data: {
        name: data.name,
        description: data.description,
        triggerType: data.triggerType,
        triggerValue: data.triggerType === "WORKFLOW_COMPLETED" ? undefined : data.triggerValue,
        triggeredByWorkflowId:
          data.triggerType === "WORKFLOW_COMPLETED"
            ? data.triggeredByWorkflowId
            : undefined,
      },
    });

    console.log("[Workflows] Workflow created:", workflow.id);
    revalidatePath("/dashboard/workflow-maps");
    return { data: { id: workflow.id }, error: null };
  } catch (error) {
    console.error("[Workflows] Error creating workflow:", error);
    return { data: null, error: "Failed to create workflow" };
  }
}

interface UpdateWorkflowData {
  name?: string;
  description?: string;
  triggerType?: WorkflowTriggerType;
  triggerValue?: string;
  triggeredByWorkflowId?: string | null;
}

export async function updateWorkflow(
  id: string,
  data: UpdateWorkflowData
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    console.log("[Workflows] Updating workflow:", id);

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.triggerType !== undefined) {
      updateData.triggerType = data.triggerType;
      if (data.triggerType === "WORKFLOW_COMPLETED") {
        updateData.triggerValue = null;
        updateData.triggeredByWorkflowId = data.triggeredByWorkflowId ?? null;
      } else {
        updateData.triggeredByWorkflowId = null;
        updateData.triggerValue = data.triggerValue ?? null;
      }
    }

    const workflow = await prisma.workflow.update({
      where: { id },
      data: updateData,
    });

    console.log("[Workflows] Workflow updated:", workflow.id);
    revalidatePath("/dashboard/workflow-maps");
    return { data: { id: workflow.id }, error: null };
  } catch (error) {
    console.error("[Workflows] Error updating workflow:", error);
    return { data: null, error: "Failed to update workflow" };
  }
}

export async function deleteWorkflow(
  id: string
): Promise<ActionResult<boolean>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    console.log("[Workflows] Deleting workflow:", id);

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: { attachments: true },
    });

    if (!workflow) return { data: null, error: "Workflow not found" };

    console.log("[Workflows] Deleting", workflow.attachments.length, "blob attachments...");
    for (const attachment of workflow.attachments) {
      try {
        await del(attachment.url);
      } catch (blobError) {
        console.error("[Workflows] Failed to delete blob:", blobError);
      }
    }

    await prisma.workflow.delete({ where: { id } });

    console.log("[Workflows] Workflow deleted:", id);
    revalidatePath("/dashboard/workflow-maps");
    return { data: true, error: null };
  } catch (error) {
    console.error("[Workflows] Error deleting workflow:", error);
    return { data: null, error: "Failed to delete workflow" };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateWorkflowFlowData(
  id: string,
  flowData: { nodes: unknown[]; edges: unknown[] }
): Promise<ActionResult<boolean>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    await prisma.workflow.update({
      where: { id },
      data: { flowData: flowData as never },
    });

    return { data: true, error: null };
  } catch (error) {
    console.error("[Workflows] Error updating flow data:", error);
    return { data: null, error: "Failed to update flow data" };
  }
}

// ============================================================================
// Workflow Attachments
// ============================================================================

export async function addWorkflowAttachment(
  workflowId: string,
  url: string,
  filename: string,
  type: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    console.log("[Workflows] Adding attachment to workflow:", workflowId);

    const attachment = await prisma.workflowAttachment.create({
      data: { workflowId, url, filename, type },
    });

    console.log("[Workflows] Attachment added:", attachment.id);
    revalidatePath("/dashboard/workflow-maps");
    return { data: { id: attachment.id }, error: null };
  } catch (error) {
    console.error("[Workflows] Error adding attachment:", error);
    return { data: null, error: "Failed to add attachment" };
  }
}

export async function removeWorkflowAttachment(
  attachmentId: string
): Promise<ActionResult<boolean>> {
  try {
    const user = await getAdminUser();
    if (!user) return { data: null, error: "Unauthorized" };

    console.log("[Workflows] Removing attachment:", attachmentId);

    const attachment = await prisma.workflowAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) return { data: null, error: "Attachment not found" };

    try {
      await del(attachment.url);
      console.log("[Workflows] Blob deleted for attachment:", attachmentId);
    } catch (blobError) {
      console.error("[Workflows] Failed to delete blob:", blobError);
    }

    await prisma.workflowAttachment.delete({ where: { id: attachmentId } });

    console.log("[Workflows] Attachment removed:", attachmentId);
    revalidatePath("/dashboard/workflow-maps");
    return { data: true, error: null };
  } catch (error) {
    console.error("[Workflows] Error removing attachment:", error);
    return { data: null, error: "Failed to remove attachment" };
  }
}
