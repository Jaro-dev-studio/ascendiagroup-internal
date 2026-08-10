import prisma from "@/lib/prisma";

interface FetchResult<T> {
  data: T | null;
  error: string | null;
}

export interface WorkflowListItem {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerValue: string | null;
  triggeredByWorkflowId: string | null;
  triggeredByWorkflow: { id: string; name: string } | null;
  _count: { attachments: number };
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowDetail {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerValue: string | null;
  triggeredByWorkflowId: string | null;
  triggeredByWorkflow: { id: string; name: string } | null;
  flowData: unknown;
  attachments: {
    id: string;
    url: string;
    filename: string;
    type: string;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export async function getWorkflows(): Promise<FetchResult<WorkflowListItem[]>> {
  try {
    const workflows = await prisma.workflow.findMany({
      include: {
        triggeredByWorkflow: { select: { id: true, name: true } },
        _count: { select: { attachments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return { data: workflows, error: null };
  } catch (error) {
    console.error("[Workflows] Error fetching workflows:", error);
    return { data: null, error: "Failed to fetch workflows" };
  }
}

export async function getWorkflow(
  id: string
): Promise<FetchResult<WorkflowDetail>> {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        triggeredByWorkflow: { select: { id: true, name: true } },
        attachments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!workflow) return { data: null, error: "Workflow not found" };
    return { data: workflow, error: null };
  } catch (error) {
    console.error("[Workflows] Error fetching workflow:", error);
    return { data: null, error: "Failed to fetch workflow" };
  }
}
