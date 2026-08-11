"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  CircleCheckBig,
  ClipboardList,
  FileText,
  Mail,
} from "lucide-react";

import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatDate, formatNumber, titleCase } from "@/lib/utils";

interface PortalClientProps {
  client: {
    name: string;
    status: string;
    packageTier: string | null;
    startDate: Date | null;
    accountManager: { name: string | null; email: string } | null;
    services: { id: string; service: string }[];
    submissions: {
      id: string;
      status: string;
      token: string;
      submittedAt: Date | null;
      form: { name: string };
    }[];
    projects: {
      id: string;
      name: string;
      status: string;
      dueDate: Date | null;
      tasks: { id: string; title: string; status: string; dueDate: Date | null }[];
    }[];
    strategies: {
      id: string;
      title: string;
      summary: string | null;
      phases: {
        id: string;
        phase: string;
        title: string;
        objective: string | null;
        items: { id: string; title: string }[];
      }[];
    }[];
    reports: {
      id: string;
      title: string;
      summary: string | null;
      highlights: string[];
      periodStart: Date;
      periodEnd: Date;
    }[];
    metrics: {
      id: string;
      label: string;
      value: number;
      unit: string | null;
    }[];
  };
}

export function PortalClient({ client }: PortalClientProps) {
  const pendingIntake = client.submissions.find(
    (submission) => submission.status === "INVITED"
  );

  const allTasks = client.projects.flatMap((project) => project.tasks);
  const completed = allTasks.filter((task) => task.status === "DONE").length;
  const percent =
    allTasks.length === 0 ? 0 : Math.round((completed / allTasks.length) * 100);

  const upcoming = allTasks
    .filter((task) => task.status !== "DONE")
    .slice(0, 6);

  const strategy = client.strategies[0];
  const latestMetrics = client.metrics.filter(
    (metric, index, all) =>
      all.findIndex((item) => item.label === metric.label) === index
  );

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo />
          <span className="text-xs text-muted-foreground">Client portal</span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-3"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-secondary-900">
            {client.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">{titleCase(client.status)}</Badge>
            {client.packageTier && (
              <Badge variant="secondary">{client.packageTier}</Badge>
            )}
            {client.services.map((service) => (
              <span
                key={service.id}
                className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs font-medium text-secondary-600"
              >
                {titleCase(service.service)}
              </span>
            ))}
          </div>
          {client.accountManager && (
            <p className="text-sm text-muted-foreground">
              Your account manager is{" "}
              {client.accountManager.name ?? client.accountManager.email}.{" "}
              <a
                href={`mailto:${client.accountManager.email}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Mail className="size-3.5" />
                Get in touch
              </a>
            </p>
          )}
        </motion.div>

        {pendingIntake && (
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-secondary-900">
                  <ClipboardList className="size-4 text-primary" />
                  Complete your onboarding form
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  We need your answers to {pendingIntake.form.name} before we can
                  start.
                </p>
              </div>
              <Button asChild>
                <a href={`/onboarding/${pendingIntake.token}`}>
                  Start now
                  <ArrowRight className="ml-2 size-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Delivery progress</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {allTasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Your delivery plan is being prepared. We will update this page as
                soon as work is scheduled.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {completed} of {allTasks.length} tasks complete
                    </span>
                    <span className="font-semibold tabular-nums text-secondary-900">
                      {percent}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full bg-accent"
                    />
                  </div>
                </div>

                {upcoming.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">
                      What we are working on
                    </p>
                    <ul className="flex flex-col divide-y divide-border">
                      {upcoming.map((task) => (
                        <li
                          key={task.id}
                          className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                        >
                          <span className="min-w-0 truncate text-sm text-secondary-800">
                            {task.title}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {task.dueDate ? formatDate(task.dueDate) : "Scheduled"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {strategy && (
          <Card>
            <CardHeader>
              <CardTitle>Your 90 day plan</CardTitle>
              {strategy.summary && (
                <p className="text-sm text-muted-foreground">{strategy.summary}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {strategy.phases.map((phase) => (
                  <div
                    key={phase.id}
                    className="rounded-md border border-border p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      {phase.phase.replace("DAY_", "First ")} days
                    </p>
                    <p className="mt-1 text-sm font-medium text-secondary-900">
                      {phase.title}
                    </p>
                    {phase.objective && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {phase.objective}
                      </p>
                    )}
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {phase.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start gap-2 text-xs text-secondary-700"
                        >
                          <CircleCheckBig className="mt-0.5 size-3 shrink-0 text-accent" />
                          {item.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {latestMetrics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Latest performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {latestMetrics.slice(0, 8).map((metric) => (
                  <div key={metric.id} className="rounded-md border border-border p-4">
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-secondary-900">
                      {formatNumber(metric.value, 2)}
                      {metric.unit ? (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          {metric.unit}
                        </span>
                      ) : null}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
          </CardHeader>
          <CardContent>
            {client.reports.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Your first report will appear here once the period closes.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {client.reports.map((report) => (
                  <div
                    key={report.id}
                    className={cn(
                      "rounded-md border border-border p-4",
                      "transition-shadow hover:shadow-card"
                    )}
                  >
                    <p className="flex items-center gap-2 text-sm font-medium text-secondary-900">
                      <FileText className="size-4 text-primary" />
                      {report.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(report.periodStart)} to{" "}
                      {formatDate(report.periodEnd)}
                    </p>
                    {report.summary && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-secondary-700">
                        {report.summary}
                      </p>
                    )}
                    {report.highlights.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-1.5">
                        {report.highlights.map((highlight) => (
                          <li
                            key={highlight}
                            className="flex items-start gap-2 text-sm text-secondary-700"
                          >
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
