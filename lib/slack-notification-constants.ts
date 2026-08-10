import { SlackNotificationEventType } from "@prisma/client";

// Re-export the enum type for client-side use
export type { SlackNotificationEventType };

// ============================================
// TYPES
// ============================================

export interface SlackNotificationConfigData {
  id: string;
  eventType: SlackNotificationEventType;
  sendToPublic: boolean;
  sendToInternal: boolean;
  clientCompanyId: string;
}

export interface ClientNotificationSettings {
  clientCompanyId: string;
  clientName: string;
  slackPublicChannelId: string | null;
  slackInternalChannelId: string | null;
  configs: SlackNotificationConfigData[];
}

// Event type labels for display
export const EVENT_TYPE_LABELS: Record<SlackNotificationEventType, string> = {
  ACTION_ITEM_CREATED: "Action Item Created",
  TASK_COMPLETED: "Task Completed",
  ACTION_ITEM_COMPLETED: "Action Item Completed",
  TASK_UNBLOCKED: "Task Unblocked",
  FEATURE_REQUESTED: "Feature Requested",
  BUG_REQUESTED: "Bug Fix Requested",
};

// Event type descriptions
export const EVENT_TYPE_DESCRIPTIONS: Record<SlackNotificationEventType, string> = {
  ACTION_ITEM_CREATED: "When a new action item is created for this client",
  TASK_COMPLETED: "When a task is marked as done",
  ACTION_ITEM_COMPLETED: "When an action item is marked as done",
  TASK_UNBLOCKED: "When all blockers for a task are resolved",
  FEATURE_REQUESTED: "When a client submits a feature request",
  BUG_REQUESTED: "When a client submits a bug report",
};

// All event types for iteration
export const ALL_EVENT_TYPES: SlackNotificationEventType[] = [
  "ACTION_ITEM_CREATED",
  "TASK_COMPLETED",
  "ACTION_ITEM_COMPLETED",
  "TASK_UNBLOCKED",
  "FEATURE_REQUESTED",
  "BUG_REQUESTED",
];
