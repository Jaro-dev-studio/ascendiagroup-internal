import prisma from "@/lib/prisma";
import type { AITool, ToolArgs, ToolPreview } from "./types";

/**
 * Human labels for entity ids so confirmation cards read like
 * "Delete task 'Fix login redirect' (Acme Corp)" instead of raw cuids.
 */
type LookupKind =
  | "task"
  | "actionItem"
  | "request"
  | "company"
  | "user"
  | "caseStudy"
  | "offer"
  | "demo"
  | "recurringTask"
  | "workflow"
  | "presentation"
  | "govContract"
  | "salesCallMap"
  | "mvpCallMap"
  | "knowledgeBaseDocument"
  | "followupTemplate"
  | "meeting"
  | "person"
  | "deal"
  | "pipelineStage"
  | "sequence"
  | "sequenceStep"
  | "enrollment"
  | "crmNote"
  | "page";

const ARG_LOOKUPS: Record<string, LookupKind> = {
  taskId: "task",
  blockedByTaskId: "task",
  actionItemId: "actionItem",
  requestId: "request",
  clientCompanyId: "company",
  companyId: "company",
  clientId: "company",
  userId: "user",
  assigneeId: "user",
  caseStudyId: "caseStudy",
  offerId: "offer",
  demoId: "demo",
  recurringTaskId: "recurringTask",
  workflowId: "workflow",
  presentationId: "presentation",
  govContractId: "govContract",
  contractId: "govContract",
  salesCallMapId: "salesCallMap",
  mvpCallMapId: "mvpCallMap",
  documentId: "knowledgeBaseDocument",
  templateId: "followupTemplate",
  meetingId: "meeting",
  personId: "person",
  primaryPersonId: "person",
  dealId: "deal",
  stageId: "pipelineStage",
  sequenceId: "sequence",
  stepId: "sequenceStep",
  enrollmentId: "enrollment",
  noteId: "crmNote",
  pageId: "page",
};

export async function lookupEntityLabel(
  kind: LookupKind,
  id: string
): Promise<string | null> {
  try {
    switch (kind) {
      case "task": {
        const row = await prisma.task.findUnique({ where: { id }, select: { name: true } });
        return row?.name ?? null;
      }
      case "actionItem": {
        const row = await prisma.actionItem.findUnique({ where: { id }, select: { name: true } });
        return row?.name ?? null;
      }
      case "request": {
        const row = await prisma.request.findUnique({ where: { id }, select: { title: true } });
        return row?.title ?? null;
      }
      case "company": {
        const row = await prisma.company.findUnique({ where: { id }, select: { name: true } });
        return row?.name ?? null;
      }
      case "user": {
        const row = await prisma.user.findUnique({
          where: { id },
          select: { firstName: true, lastName: true, email: true },
        });
        if (!row) return null;
        return `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || row.email;
      }
      case "caseStudy": {
        const row = await prisma.caseStudy.findUnique({ where: { id }, select: { name: true } });
        return row?.name ?? null;
      }
      case "offer": {
        const row = await prisma.offer.findUnique({ where: { id }, select: { title: true } });
        return row?.title ?? null;
      }
      case "demo": {
        const row = await prisma.demo.findUnique({ where: { id }, select: { name: true } });
        return row?.name ?? null;
      }
      case "recurringTask": {
        const row = await prisma.recurringTask.findUnique({ where: { id }, select: { name: true } });
        return row?.name ?? null;
      }
      case "workflow": {
        const row = await prisma.workflow.findUnique({ where: { id }, select: { name: true } });
        return row?.name ?? null;
      }
      case "presentation": {
        const row = await prisma.presentation.findUnique({ where: { id }, select: { title: true } });
        return row?.title ?? null;
      }
      case "govContract": {
        const row = await prisma.govContract.findUnique({ where: { id }, select: { title: true } });
        return row?.title ?? null;
      }
      case "salesCallMap": {
        const row = await prisma.salesCallMap.findUnique({ where: { id }, select: { name: true } });
        return row?.name ?? null;
      }
      case "mvpCallMap": {
        const row = await prisma.mVPCallMap.findUnique({ where: { id }, select: { name: true } });
        return row?.name ?? null;
      }
      case "knowledgeBaseDocument": {
        const row = await prisma.knowledgeBaseDocument.findUnique({
          where: { id },
          select: { title: true },
        });
        return row?.title ?? null;
      }
      case "followupTemplate": {
        const row = await prisma.followupTemplate.findUnique({
          where: { id },
          select: { name: true },
        });
        return row?.name ?? null;
      }
      case "meeting": {
        const row = await prisma.meeting.findUnique({ where: { id }, select: { title: true } });
        return row?.title ?? null;
      }
      case "person": {
        const row = await prisma.person.findUnique({
          where: { id },
          select: { fullName: true, email: true },
        });
        if (!row) return null;
        return row.fullName || row.email;
      }
      case "deal": {
        const row = await prisma.deal.findUnique({ where: { id }, select: { name: true } });
        return row?.name ?? null;
      }
      case "pipelineStage": {
        const row = await prisma.pipelineStage.findUnique({
          where: { id },
          select: { name: true },
        });
        return row?.name ?? null;
      }
      case "sequence": {
        const row = await prisma.sequence.findUnique({ where: { id }, select: { name: true } });
        return row?.name ?? null;
      }
      case "sequenceStep": {
        const row = await prisma.sequenceStep.findUnique({
          where: { id },
          select: { order: true, subject: true },
        });
        if (!row) return null;
        return `Step ${row.order}: ${row.subject}`;
      }
      case "enrollment": {
        const row = await prisma.sequenceEnrollment.findUnique({
          where: { id },
          select: {
            sequence: { select: { name: true } },
            person: { select: { fullName: true, email: true } },
          },
        });
        if (!row) return null;
        const person = row.person.fullName || row.person.email || "Unknown contact";
        return `${person} in ${row.sequence.name}`;
      }
      case "crmNote": {
        const row = await prisma.crmNote.findUnique({
          where: { id },
          select: { title: true, content: true },
        });
        if (!row) return null;
        return row.title || row.content.slice(0, 80);
      }
      case "page": {
        const row = await prisma.page.findUnique({
          where: { id },
          select: { label: true, path: true },
        });
        if (!row) return null;
        return `${row.label} (${row.path})`;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .replace(/ Id$/, "")
    .trim();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "none";
    return value.map((item) => formatValue(item)).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

/**
 * Resolves every id-like argument to a readable name and returns the
 * argument list as display-ready key/value pairs.
 */
export async function resolveArgDetails(args: ToolArgs): Promise<Record<string, unknown>> {
  const details: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;

    const lookupKind = ARG_LOOKUPS[key];
    if (lookupKind && typeof value === "string" && value.length > 0) {
      const label = await lookupEntityLabel(lookupKind, value);
      details[humanizeKey(key)] = label ? `${label} (${value})` : value;
      continue;
    }

    details[humanizeKey(key)] = formatValue(value);
  }

  return details;
}

export async function buildToolPreview(tool: AITool, args: ToolArgs): Promise<ToolPreview> {
  if (tool.preview) {
    try {
      return await tool.preview(args);
    } catch (error) {
      console.error(`[AITools] preview failed for ${tool.name}:`, error);
    }
  }

  const details = await resolveArgDetails(args);
  const summary = Object.entries(details)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");

  return {
    title: tool.label,
    summary: summary || "No additional parameters.",
    details,
  };
}
