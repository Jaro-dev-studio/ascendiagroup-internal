"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  Building2,
  CircleAlert,
  CircleCheckBig,
  FolderKanban,
  Inbox,
  Plus,
  UserPlus,
} from "lucide-react";

import { BarChart } from "@/components/shared/bar-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardOverview } from "@/lib/fetchers/dashboard";
import { formatDate, formatRelative } from "@/lib/utils";

interface DashboardClientProps {
  overview: DashboardOverview | null;
  error: string | null;
  firstName: string;
}

export function DashboardClient({
  overview,
  error,
  firstName,
}: DashboardClientProps) {
  if (error || !overview) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Dashboard unavailable"
        description={error ?? "Something went wrong loading the overview."}
      />
    );
  }

  const { counts, onboarding, myTasks, activity } = overview;
  const hasAnyData =
    counts.activeClients + counts.onboardingClients + counts.openTasks > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description="Delivery health across onboarding, projects and client tasks."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/onboarding/submissions">
                <Inbox className="mr-2 size-4" />
                Review intake
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/clients/new">
                <Plus className="mr-2 size-4" />
                New client
              </Link>
            </Button>
          </>
        }
      />

      {!hasAnyData ? (
        <EmptyState
          icon={UserPlus}
          title="No clients yet"
          description="Add your first practice, send them an onboarding form and the dashboard will fill up with delivery data."
          action={
            <Button asChild>
              <Link href="/dashboard/clients/new">
                <Plus className="mr-2 size-4" />
                Add your first client
              </Link>
            </Button>
          }
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            label="Active clients"
            value={counts.activeClients}
            icon={Building2}
            href="/dashboard/clients"
            hint={`${counts.onboardingClients} onboarding`}
          />
          <StatCard
            label="Active projects"
            value={counts.activeProjects}
            icon={FolderKanban}
            tone="accent"
            href="/dashboard/projects"
          />
          <StatCard
            label="Open tasks"
            value={counts.openTasks}
            icon={CircleCheckBig}
            tone="neutral"
            href="/dashboard/tasks"
            hint={`${counts.overdueTasks} overdue`}
          />
          <StatCard
            label="Intake to review"
            value={counts.pendingSubmissions}
            icon={Inbox}
            tone="warning"
            href="/dashboard/onboarding/submissions"
          />
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Onboarding in progress</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/clients">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {onboarding.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No practices are currently onboarding.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {onboarding.map((client) => (
                  <Link
                    key={client.id}
                    href={`/dashboard/clients/${client.id}`}
                    className="flex flex-col gap-2 py-3 transition-colors first:pt-0 last:pb-0 hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-secondary-900">
                        {client.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {client.accountManager
                          ? `Managed by ${client.accountManager}`
                          : "No account manager assigned"}
                        {client.submittedAt
                          ? ` · Intake ${formatDate(client.submittedAt)}`
                          : " · Intake pending"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {client.completedTasks}/{client.totalTasks} tasks
                      </span>
                      <StatusBadge kind="client" value={client.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My open tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {myTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing assigned to you right now.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {myTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-secondary-900">
                        {task.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {task.clientName ?? "Internal"}
                        {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ""}
                      </p>
                    </div>
                    <StatusBadge kind="priority" value={task.priority} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Activity appears here as onboarding, calls and tasks progress.
              </p>
            ) : (
              <ol className="flex flex-col gap-4">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-secondary-900">
                        {entry.link ? (
                          <Link
                            href={entry.link}
                            className="font-medium hover:underline"
                          >
                            {entry.title}
                          </Link>
                        ) : (
                          <span className="font-medium">{entry.title}</span>
                        )}
                        {entry.clientName ? ` · ${entry.clientName}` : ""}
                      </p>
                      {entry.description && (
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatRelative(entry.createdAt)}
                        {entry.actorName ? ` · ${entry.actorName}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workload split</CardTitle>
          </CardHeader>
          <CardContent>
            {counts.openTasks === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No open tasks to break down yet.
              </p>
            ) : (
              <BarChart
                data={[
                  { label: "Open tasks", value: counts.openTasks },
                  { label: "Overdue", value: counts.overdueTasks },
                  { label: "Active projects", value: counts.activeProjects },
                  { label: "Intake to review", value: counts.pendingSubmissions },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="size-3.5" />
        Figures update as onboarding forms, calls and tasks are processed.
      </p>
    </div>
  );
}
