import { acceptRequest, rejectRequest, updateRequest, deleteRequest } from "@/lib/actions";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { changeSummary, deletePreview, toDate, unwrapAction } from "./helpers";

const PRIORITY_ENUM = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const STATUS_ENUM = ["PENDING_ADMIN_REVIEW", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

type RequestPriority = (typeof PRIORITY_ENUM)[number];
type TaskStatus = (typeof STATUS_ENUM)[number];

export const requestWriteTools: AITool[] = [
  defineTool({
    name: "acceptRequest",
    label: "Accept Request",
    risk: "additive",
    description:
      "Accept a feature request or bug report and turn it into a development task. Resolve the request ID with queryRequests first.",
    parameters: {
      properties: {
        requestId: { type: "string", description: "The request ID" },
        name: { type: "string", description: "Name for the task that will be created" },
        description: { type: "string", description: "Task description" },
        priority: { type: "string", enum: [...PRIORITY_ENUM], description: "Task priority" },
        status: { type: "string", enum: [...STATUS_ENUM], description: "Initial task status" },
        dueDate: { type: "string", description: "Due date as an ISO 8601 date string" },
        assigneeId: { type: "string", description: "Assignee user ID" },
      },
      required: ["requestId", "name"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("request", String(args.requestId));
      return {
        title: "Accept request",
        summary: `Accept ${label ? `"${label}"` : String(args.requestId)} and create the task "${args.name}".`,
        details: {
          Priority: (args.priority as string) ?? "MEDIUM",
          Status: (args.status as string) ?? "TODO",
          "Due date": (args.dueDate as string) ?? "—",
        },
      };
    },
    execute: async (args) =>
      unwrapAction(
        acceptRequest(args.requestId as string, {
          name: args.name as string,
          description: args.description as string | undefined,
          priority: (args.priority as RequestPriority) ?? "MEDIUM",
          status: (args.status as TaskStatus) ?? "TODO",
          dueDate: toDate(args.dueDate),
          assigneeId: args.assigneeId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "rejectRequest",
    label: "Reject Request",
    risk: "additive",
    description: "Reject a feature request or bug report with a comment explaining why.",
    parameters: {
      properties: {
        requestId: { type: "string", description: "The request ID" },
        rejectionComment: { type: "string", description: "Reason shown to the client" },
      },
      required: ["requestId", "rejectionComment"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("request", String(args.requestId));
      return {
        title: "Reject request",
        summary: `Reject ${label ? `"${label}"` : String(args.requestId)}.`,
        details: { Reason: String(args.rejectionComment) },
      };
    },
    execute: async (args) =>
      unwrapAction(
        rejectRequest(args.requestId as string, args.rejectionComment as string)
      ),
  }),

  defineTool({
    name: "updateRequest",
    label: "Update Request",
    risk: "additive",
    description: "Update the details of a submitted request.",
    parameters: {
      properties: {
        requestId: { type: "string", description: "The request ID" },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
        priority: { type: "string", enum: [...PRIORITY_ENUM], description: "New priority" },
        stepsToReproduce: { type: "string", description: "Bug steps to reproduce" },
        expectedBehavior: { type: "string", description: "Bug expected behavior" },
        bugSeverity: {
          type: "string",
          enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
          description: "Bug severity",
        },
      },
      required: ["requestId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("request", String(args.requestId));
      return {
        title: "Update request",
        summary: `${label ? `"${label}"` : String(args.requestId)} — ${changeSummary(args, ["requestId"])}`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateRequest(args.requestId as string, {
          title: args.title as string | undefined,
          description: args.description as string | undefined,
          priority: args.priority as RequestPriority | undefined,
          stepsToReproduce: args.stepsToReproduce as string | undefined,
          expectedBehavior: args.expectedBehavior as string | undefined,
          bugSeverity: args.bugSeverity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | undefined,
        })
      ),
  }),

  defineTool({
    name: "deleteRequest",
    label: "Delete Request",
    risk: "destructive",
    description: "Permanently delete a feature request or bug report.",
    parameters: {
      properties: { requestId: { type: "string", description: "The request ID" } },
      required: ["requestId"],
    },
    preview: deletePreview("request", "requestId", "request"),
    execute: async (args) => unwrapAction(deleteRequest(args.requestId as string)),
  }),
];
