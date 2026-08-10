import {
  createTask,
  updateTask,
  deleteTask,
  createRecurringTask,
  updateRecurringTask,
  deleteRecurringTask,
  toggleRecurringTaskActive,
  executeTaskWithAgent,
} from "@/lib/actions";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { changeSummary, clientNameFor, deletePreview, toDate, unwrapAction } from "./helpers";

const PRIORITY_ENUM = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const STATUS_ENUM = ["PENDING_ADMIN_REVIEW", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

type TaskPriority = (typeof PRIORITY_ENUM)[number];
type TaskStatus = (typeof STATUS_ENUM)[number];

export const taskWriteTools: AITool[] = [
  defineTool({
    name: "createTask",
    label: "Create Task",
    risk: "additive",
    description:
      "Create a development task for a client. Resolve the client company ID with queryClients and the assignee ID with queryUsers first.",
    parameters: {
      properties: {
        name: { type: "string", description: "Task name" },
        description: { type: "string", description: "Task description" },
        priority: { type: "string", enum: [...PRIORITY_ENUM], description: "Task priority" },
        status: { type: "string", enum: [...STATUS_ENUM], description: "Initial status" },
        dueDate: { type: "string", description: "Due date as an ISO 8601 date string" },
        clientCompanyId: { type: "string", description: "Client company ID" },
        assigneeId: { type: "string", description: "Assignee user ID" },
        blockedByTaskIds: {
          type: "array",
          items: { type: "string" },
          description: "Task IDs that block this task",
        },
        blockedByActionItemIds: {
          type: "array",
          items: { type: "string" },
          description: "Action item IDs that block this task",
        },
      },
      required: ["name", "clientCompanyId"],
    },
    preview: async (args) => {
      const clientName = await clientNameFor(args.clientCompanyId);
      return {
        title: "Create task",
        summary: `"${args.name}"${clientName ? ` for ${clientName}` : ""}`,
        details: {
          Priority: (args.priority as string) ?? "MEDIUM",
          Status: (args.status as string) ?? "TODO",
          "Due date": (args.dueDate as string) ?? "—",
          Description: (args.description as string) ?? "—",
        },
      };
    },
    execute: async (args) =>
      unwrapAction(
        createTask({
          name: args.name as string,
          description: args.description as string | undefined,
          priority: (args.priority as TaskPriority) ?? "MEDIUM",
          status: (args.status as TaskStatus) ?? "TODO",
          dueDate: toDate(args.dueDate),
          clientCompanyId: args.clientCompanyId as string,
          assigneeId: args.assigneeId as string | undefined,
          blockedByTaskIds: args.blockedByTaskIds as string[] | undefined,
          blockedByActionItemIds: args.blockedByActionItemIds as string[] | undefined,
        })
      ),
  }),

  defineTool({
    name: "updateTask",
    label: "Update Task",
    risk: "additive",
    description:
      "Update an existing task. Only the fields you provide are changed. Resolve the task ID with queryTasks first.",
    parameters: {
      properties: {
        taskId: { type: "string", description: "The task ID" },
        name: { type: "string", description: "New task name" },
        description: { type: "string", description: "New description" },
        priority: { type: "string", enum: [...PRIORITY_ENUM], description: "New priority" },
        status: { type: "string", enum: [...STATUS_ENUM], description: "New status" },
        dueDate: { type: "string", description: "New due date as an ISO 8601 date string" },
        clientCompanyId: { type: "string", description: "Move the task to this client company" },
        assigneeId: { type: "string", description: "New assignee user ID" },
        blockedByTaskIds: {
          type: "array",
          items: { type: "string" },
          description: "Replace the blocking task IDs",
        },
        blockedByActionItemIds: {
          type: "array",
          items: { type: "string" },
          description: "Replace the blocking action item IDs",
        },
      },
      required: ["taskId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("task", String(args.taskId));
      return {
        title: "Update task",
        summary: `${label ? `"${label}"` : String(args.taskId)} — ${changeSummary(args, ["taskId"])}`,
        details: { Task: label ?? String(args.taskId) },
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateTask(args.taskId as string, {
          name: args.name as string | undefined,
          description: args.description as string | undefined,
          priority: args.priority as TaskPriority | undefined,
          status: args.status as TaskStatus | undefined,
          dueDate: toDate(args.dueDate),
          clientCompanyId: args.clientCompanyId as string | undefined,
          assigneeId: args.assigneeId as string | undefined,
          blockedByTaskIds: args.blockedByTaskIds as string[] | undefined,
          blockedByActionItemIds: args.blockedByActionItemIds as string[] | undefined,
        })
      ),
  }),

  defineTool({
    name: "deleteTask",
    label: "Delete Task",
    risk: "destructive",
    description: "Permanently delete a task. Resolve the task ID with queryTasks first.",
    parameters: {
      properties: { taskId: { type: "string", description: "The task ID" } },
      required: ["taskId"],
    },
    preview: deletePreview("task", "taskId", "task"),
    execute: async (args) => unwrapAction(deleteTask(args.taskId as string)),
  }),

  defineTool({
    name: "runTaskAgent",
    label: "Run Cursor Agent On Task",
    risk: "destructive",
    description:
      "Launch a Cursor cloud agent to work on a task in a GitHub repository. This starts real work in an external system and may open a pull request.",
    parameters: {
      properties: {
        taskId: { type: "string", description: "The task ID" },
        repoName: { type: "string", description: "The GitHub repository name" },
        additionalPrompt: { type: "string", description: "Extra instructions for the agent" },
      },
      required: ["taskId", "repoName"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("task", String(args.taskId));
      return {
        title: "Launch Cursor agent",
        summary: `Start a cloud agent on ${label ? `"${label}"` : String(args.taskId)} in ${args.repoName}. This writes code and may open a pull request.`,
        details: {
          Repository: String(args.repoName),
          Instructions: (args.additionalPrompt as string) ?? "—",
        },
      };
    },
    execute: async (args) =>
      unwrapAction(
        executeTaskWithAgent(
          args.taskId as string,
          args.repoName as string,
          args.additionalPrompt as string | undefined
        )
      ),
  }),

  defineTool({
    name: "createRecurringTask",
    label: "Create Recurring Task",
    risk: "additive",
    description: "Create a recurring task schedule for a client.",
    parameters: {
      properties: {
        name: { type: "string", description: "Recurring task name" },
        description: { type: "string", description: "Description" },
        priority: { type: "string", enum: [...PRIORITY_ENUM], description: "Priority" },
        frequency: {
          type: "string",
          enum: ["DAILY", "WEEKLY", "MONTHLY"],
          description: "How often the task recurs",
        },
        dayOfWeek: { type: "number", description: "0-6 (Sun-Sat), required for WEEKLY" },
        dayOfMonth: { type: "number", description: "1-31, required for MONTHLY" },
        clientCompanyId: { type: "string", description: "Client company ID" },
        assigneeId: { type: "string", description: "Assignee user ID" },
      },
      required: ["name", "frequency", "clientCompanyId"],
    },
    preview: async (args) => {
      const clientName = await clientNameFor(args.clientCompanyId);
      return {
        title: "Create recurring task",
        summary: `"${args.name}" ${String(args.frequency).toLowerCase()}${clientName ? ` for ${clientName}` : ""}`,
        details: {
          Priority: (args.priority as string) ?? "MEDIUM",
          "Day of week": args.dayOfWeek ?? "—",
          "Day of month": args.dayOfMonth ?? "—",
        },
      };
    },
    execute: async (args) =>
      unwrapAction(
        createRecurringTask({
          name: args.name as string,
          description: args.description as string | undefined,
          priority: (args.priority as TaskPriority) ?? "MEDIUM",
          frequency: args.frequency as "DAILY" | "WEEKLY" | "MONTHLY",
          dayOfWeek: args.dayOfWeek as number | undefined,
          dayOfMonth: args.dayOfMonth as number | undefined,
          clientCompanyId: args.clientCompanyId as string,
          assigneeId: args.assigneeId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "updateRecurringTask",
    label: "Update Recurring Task",
    risk: "additive",
    description: "Update a recurring task schedule. Only the fields you provide are changed.",
    parameters: {
      properties: {
        recurringTaskId: { type: "string", description: "The recurring task ID" },
        name: { type: "string", description: "New name" },
        description: { type: "string", description: "New description" },
        priority: { type: "string", enum: [...PRIORITY_ENUM], description: "New priority" },
        frequency: {
          type: "string",
          enum: ["DAILY", "WEEKLY", "MONTHLY"],
          description: "New frequency",
        },
        dayOfWeek: { type: "number", description: "0-6 (Sun-Sat)" },
        dayOfMonth: { type: "number", description: "1-31" },
        isActive: { type: "boolean", description: "Whether the schedule is active" },
        clientCompanyId: { type: "string", description: "New client company ID" },
        assigneeId: { type: "string", description: "New assignee user ID" },
      },
      required: ["recurringTaskId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("recurringTask", String(args.recurringTaskId));
      return {
        title: "Update recurring task",
        summary: `${label ? `"${label}"` : String(args.recurringTaskId)} — ${changeSummary(args, ["recurringTaskId"])}`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateRecurringTask(args.recurringTaskId as string, {
          name: args.name as string | undefined,
          description: args.description as string | undefined,
          priority: args.priority as TaskPriority | undefined,
          frequency: args.frequency as "DAILY" | "WEEKLY" | "MONTHLY" | undefined,
          dayOfWeek: args.dayOfWeek as number | undefined,
          dayOfMonth: args.dayOfMonth as number | undefined,
          isActive: args.isActive as boolean | undefined,
          clientCompanyId: args.clientCompanyId as string | undefined,
          assigneeId: args.assigneeId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "toggleRecurringTask",
    label: "Toggle Recurring Task",
    risk: "additive",
    description: "Flip a recurring task schedule between active and paused.",
    parameters: {
      properties: {
        recurringTaskId: { type: "string", description: "The recurring task ID" },
      },
      required: ["recurringTaskId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("recurringTask", String(args.recurringTaskId));
      return {
        title: "Toggle recurring task",
        summary: `Flip the active state of ${label ? `"${label}"` : String(args.recurringTaskId)}.`,
      };
    },
    execute: async (args) =>
      unwrapAction(toggleRecurringTaskActive(args.recurringTaskId as string)),
  }),

  defineTool({
    name: "deleteRecurringTask",
    label: "Delete Recurring Task",
    risk: "destructive",
    description: "Permanently delete a recurring task schedule.",
    parameters: {
      properties: {
        recurringTaskId: { type: "string", description: "The recurring task ID" },
      },
      required: ["recurringTaskId"],
    },
    preview: deletePreview("recurringTask", "recurringTaskId", "recurring task"),
    execute: async (args) =>
      unwrapAction(deleteRecurringTask(args.recurringTaskId as string)),
  }),
];
