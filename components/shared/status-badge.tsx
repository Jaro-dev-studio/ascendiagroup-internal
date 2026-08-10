import type {
  ClientStatus,
  ProjectStatus,
  StrategyStatus,
  SubmissionStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "outline";

const CLIENT_STATUS: Record<ClientStatus, BadgeVariant> = {
  LEAD: "secondary",
  ONBOARDING: "default",
  ACTIVE: "success",
  PAUSED: "warning",
  CHURNED: "destructive",
};

const PROJECT_STATUS: Record<ProjectStatus, BadgeVariant> = {
  PLANNING: "secondary",
  ACTIVE: "default",
  ON_HOLD: "warning",
  COMPLETED: "success",
};

const TASK_STATUS: Record<TaskStatus, BadgeVariant> = {
  BACKLOG: "outline",
  TODO: "secondary",
  IN_PROGRESS: "default",
  REVIEW: "warning",
  DONE: "success",
};

const TASK_PRIORITY: Record<TaskPriority, BadgeVariant> = {
  LOW: "outline",
  MEDIUM: "secondary",
  HIGH: "warning",
  URGENT: "destructive",
};

const SUBMISSION_STATUS: Record<SubmissionStatus, BadgeVariant> = {
  INVITED: "secondary",
  SUBMITTED: "default",
  PROCESSED: "success",
};

const STRATEGY_STATUS: Record<StrategyStatus, BadgeVariant> = {
  DRAFT: "secondary",
  IN_REVIEW: "warning",
  APPROVED: "success",
};

const MAPS = {
  client: CLIENT_STATUS,
  project: PROJECT_STATUS,
  task: TASK_STATUS,
  priority: TASK_PRIORITY,
  submission: SUBMISSION_STATUS,
  strategy: STRATEGY_STATUS,
} as const;

interface StatusBadgeProps {
  kind: keyof typeof MAPS;
  value: string;
}

export function StatusBadge({ kind, value }: StatusBadgeProps) {
  const variant =
    (MAPS[kind] as Record<string, BadgeVariant>)[value] ?? "secondary";

  return <Badge variant={variant}>{titleCase(value)}</Badge>;
}
