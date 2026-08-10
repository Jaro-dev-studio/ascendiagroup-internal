"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  BookOpen,
  Copy,
  ExternalLink,
  FolderKanban,
  Link2,
  Mail,
  MessageCircle,
  Mic,
  Pencil,
  Phone,
  RefreshCw,
  Route,
  Trello,
} from "lucide-react";
import { toast } from "sonner";

import { BarChart } from "@/components/shared/bar-chart";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  provisionDriveFolder,
  provisionTrelloBoard,
  refreshClientMetrics,
} from "@/lib/actions/workspace";
import { formatCurrency, formatDate, formatRelative, titleCase } from "@/lib/utils";

type ClientDetail = {
  id: string;
  name: string;
  status: string;
  practiceType: string | null;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  whatsappNumber: string | null;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  packageTier: string | null;
  monthlyRetainer: number | null;
  startDate: Date | null;
  notes: string | null;
  portalToken: string;
  driveFolderUrl: string | null;
  trelloBoardUrl: string | null;
  accountManager: { id: string; name: string | null; email: string } | null;
  services: { id: string; service: string }[];
  integrationLinks: { id: string; provider: string; externalId: string }[];
  projects: {
    id: string;
    name: string;
    status: string;
    dueDate: Date | null;
    _count: { tasks: number };
  }[];
  submissions: {
    id: string;
    status: string;
    submittedAt: Date | null;
    invitedAt: Date;
    token: string;
    form: { name: string };
  }[];
  strategies: {
    id: string;
    title: string;
    status: string;
    generatedAt: Date | null;
    phases: { id: string; _count: { items: number } }[];
  }[];
  meetings: {
    id: string;
    title: string;
    type: string;
    occurredAt: Date;
    summary: string | null;
  }[];
  documents: {
    id: string;
    title: string;
    source: string;
    updatedAt: Date;
  }[];
  whatsapp: {
    id: string;
    senderName: string | null;
    fromNumber: string;
    body: string | null;
    sentAt: Date;
  }[];
  metrics: {
    id: string;
    label: string;
    value: number;
    unit: string | null;
    periodStart: Date;
  }[];
  reports: {
    id: string;
    title: string;
    status: string;
    periodEnd: Date;
  }[];
  activities: {
    id: string;
    title: string;
    description: string | null;
    createdAt: Date;
    link: string | null;
  }[];
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: Date | null;
    assignee: { name: string | null; email: string } | null;
  }[];
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-secondary-900">{value || "—"}</dd>
    </div>
  );
}

export function ClientDetailClient({ client }: { client: ClientDetail }) {
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const portalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/portal/${client.portalToken}`
      : `/portal/${client.portalToken}`;

  function runAction(key: string, action: () => Promise<{ error: string | null }>) {
    setActiveAction(key);
    startTransition(async () => {
      const { error } = await action();
      if (error) toast.error(error);
      else toast.success("Done.");
      setActiveAction(null);
    });
  }

  const openTasks = client.tasks.filter((task) => task.status !== "DONE");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={client.name}
        description={
          [client.practiceType, client.city, client.packageTier]
            .filter(Boolean)
            .join(" · ") || "No practice details captured yet"
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(portalUrl);
                toast.success("Client portal link copied.");
              }}
            >
              <Copy className="mr-2 size-4" />
              Portal link
            </Button>
            <Button asChild variant="outline">
              <Link href={`/dashboard/clients/${client.id}/edit`}>
                <Pencil className="mr-2 size-4" />
                Edit
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/dashboard/strategies/new?clientId=${client.id}`}>
                <Route className="mr-2 size-4" />
                Generate strategy
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind="client" value={client.status} />
        {client.services.map((service) => (
          <span
            key={service.id}
            className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs font-medium text-secondary-600"
          >
            {titleCase(service.service)}
          </span>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto scrollbar-thin">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="context">Context</TabsTrigger>
          <TabsTrigger value="reporting">Reporting</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Practice record</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
                  <DetailRow label="Contact" value={client.contactName} />
                  <DetailRow
                    label="Email"
                    value={
                      client.contactEmail && (
                        <a
                          href={`mailto:${client.contactEmail}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Mail className="size-3.5" />
                          {client.contactEmail}
                        </a>
                      )
                    }
                  />
                  <DetailRow
                    label="Phone"
                    value={
                      client.contactPhone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3.5" />
                          {client.contactPhone}
                        </span>
                      )
                    }
                  />
                  <DetailRow label="WhatsApp" value={client.whatsappNumber} />
                  <DetailRow
                    label="Website"
                    value={
                      client.website && (
                        <a
                          href={client.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {client.website}
                          <ExternalLink className="size-3.5" />
                        </a>
                      )
                    }
                  />
                  <DetailRow
                    label="Address"
                    value={[client.addressLine, client.city, client.country]
                      .filter(Boolean)
                      .join(", ")}
                  />
                  <DetailRow
                    label="Account manager"
                    value={
                      client.accountManager?.name ?? client.accountManager?.email
                    }
                  />
                  <DetailRow
                    label="Retainer"
                    value={
                      client.monthlyRetainer
                        ? `${formatCurrency(client.monthlyRetainer)} / month`
                        : null
                    }
                  />
                  <DetailRow label="Start date" value={formatDate(client.startDate)} />
                  <DetailRow label="Package" value={client.packageTier} />
                </dl>

                {client.notes && (
                  <div className="mt-4 rounded-md bg-muted p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      Internal notes
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-secondary-800">
                      {client.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Connected workspace</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {client.driveFolderUrl ? (
                    <a
                      href={client.driveFolderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <FolderKanban className="size-4 text-primary" />
                        Google Drive folder
                      </span>
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                    </a>
                  ) : (
                    <Button
                      variant="outline"
                      className="justify-start"
                      disabled={isPending && activeAction === "drive"}
                      onClick={() =>
                        runAction("drive", () => provisionDriveFolder(client.id))
                      }
                    >
                      <FolderKanban className="mr-2 size-4" />
                      Create Drive folder
                    </Button>
                  )}

                  {client.trelloBoardUrl ? (
                    <a
                      href={client.trelloBoardUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <Trello className="size-4 text-primary" />
                        Trello board
                      </span>
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                    </a>
                  ) : (
                    <Button
                      variant="outline"
                      className="justify-start"
                      disabled={isPending && activeAction === "trello"}
                      onClick={() =>
                        runAction("trello", () => provisionTrelloBoard(client.id))
                      }
                    >
                      <Trello className="mr-2 size-4" />
                      Create Trello board
                    </Button>
                  )}

                  <Button asChild variant="outline" className="justify-start">
                    <Link href={`/dashboard/knowledge-base?clientId=${client.id}`}>
                      <BookOpen className="mr-2 size-4" />
                      Open knowledge base
                    </Link>
                  </Button>

                  {client.integrationLinks.length > 0 && (
                    <div className="rounded-md bg-muted p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Reporting accounts
                      </p>
                      <ul className="mt-1 flex flex-col gap-1">
                        {client.integrationLinks.map((link) => (
                          <li key={link.id} className="text-xs text-secondary-700">
                            <Link2 className="mr-1 inline size-3" />
                            {titleCase(link.provider)}: {link.externalId}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  {client.activities.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Nothing has happened on this account yet.
                    </p>
                  ) : (
                    <ol className="flex flex-col gap-3">
                      {client.activities.slice(0, 8).map((entry) => (
                        <li key={entry.id} className="flex gap-3">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                          <div className="min-w-0">
                            <p className="text-sm text-secondary-900">
                              {entry.link ? (
                                <Link href={entry.link} className="hover:underline">
                                  {entry.title}
                                </Link>
                              ) : (
                                entry.title
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatRelative(entry.createdAt)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="onboarding">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Intake submissions</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/onboarding/submissions?clientId=${client.id}`}>
                  Send new form
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {client.submissions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No onboarding form has been sent to this practice yet.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {client.submissions.map((submission) => (
                    <Link
                      key={submission.id}
                      href={`/dashboard/onboarding/submissions/${submission.id}`}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-muted"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-secondary-900">
                          {submission.form.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Invited {formatDate(submission.invitedAt)}
                          {submission.submittedAt
                            ? ` · Submitted ${formatDate(submission.submittedAt)}`
                            : " · Awaiting response"}
                        </p>
                      </div>
                      <StatusBadge kind="submission" value={submission.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Projects</CardTitle>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/projects/new?clientId=${client.id}`}>
                    New project
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {client.projects.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No projects yet. Process an onboarding submission or create one
                    manually.
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {client.projects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/dashboard/projects/${project.id}`}
                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-muted"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-secondary-900">
                            {project.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {project._count.tasks} tasks
                            {project.dueDate
                              ? ` · due ${formatDate(project.dueDate)}`
                              : ""}
                          </p>
                        </div>
                        <StatusBadge kind="project" value={project.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Open tasks</CardTitle>
              </CardHeader>
              <CardContent>
                {openTasks.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No open tasks for this client.
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {openTasks.slice(0, 10).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-secondary-900">
                            {task.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {task.assignee?.name ?? task.assignee?.email ?? "Unassigned"}
                            {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ""}
                          </p>
                        </div>
                        <StatusBadge kind="task" value={task.status} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="strategy">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>90 day roadmaps</CardTitle>
              <Button asChild size="sm">
                <Link href={`/dashboard/strategies/new?clientId=${client.id}`}>
                  Generate
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {client.strategies.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No strategy generated yet. Claude builds one from the onboarding
                  answers and call transcripts.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {client.strategies.map((strategy) => (
                    <Link
                      key={strategy.id}
                      href={`/dashboard/strategies/${strategy.id}`}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-muted"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-secondary-900">
                          {strategy.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {strategy.phases.reduce(
                            (total, phase) => total + phase._count.items,
                            0
                          )}{" "}
                          actions · {formatDate(strategy.generatedAt)}
                        </p>
                      </div>
                      <StatusBadge kind="strategy" value={strategy.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="context">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Documents</CardTitle>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/dashboard/knowledge-base?clientId=${client.id}`}>
                    Open
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {client.documents.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    The knowledge base is empty.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {client.documents.map((document) => (
                      <li key={document.id} className="py-2 first:pt-0 last:pb-0">
                        <p className="truncate text-sm text-secondary-900">
                          {document.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {titleCase(document.source)} ·{" "}
                          {formatRelative(document.updatedAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Calls</CardTitle>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/dashboard/meetings?clientId=${client.id}`}>Open</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {client.meetings.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No calls logged yet.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {client.meetings.map((meeting) => (
                      <li key={meeting.id} className="py-2 first:pt-0 last:pb-0">
                        <Link
                          href={`/dashboard/meetings/${meeting.id}`}
                          className="text-sm text-secondary-900 hover:underline"
                        >
                          <Mic className="mr-1 inline size-3.5 text-muted-foreground" />
                          {meeting.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {titleCase(meeting.type)} · {formatDate(meeting.occurredAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>WhatsApp</CardTitle>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/dashboard/whatsapp?clientId=${client.id}`}>Open</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {client.whatsapp.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No WhatsApp messages captured.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {client.whatsapp.map((message) => (
                      <li key={message.id} className="py-2 first:pt-0 last:pb-0">
                        <p className="line-clamp-2 text-sm text-secondary-900">
                          <MessageCircle className="mr-1 inline size-3.5 text-muted-foreground" />
                          {message.body ?? "Media message"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {message.senderName ?? message.fromNumber} ·{" "}
                          {formatRelative(message.sentAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reporting">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Latest KPIs</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending && activeAction === "metrics"}
                  onClick={() =>
                    runAction("metrics", () => refreshClientMetrics(client.id))
                  }
                >
                  <RefreshCw className="mr-2 size-3.5" />
                  Sync
                </Button>
              </CardHeader>
              <CardContent>
                {client.metrics.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Connect AgencyAnalytics, SEMrush or Google Ads and link this
                    client&apos;s account to pull KPIs.
                  </p>
                ) : (
                  <BarChart
                    data={client.metrics.slice(0, 8).map((metric) => ({
                      label: metric.label,
                      value: metric.value,
                    }))}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Reports</CardTitle>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/dashboard/reporting?clientId=${client.id}`}>Open</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {client.reports.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No reports published yet.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {client.reports.map((report) => (
                      <li
                        key={report.id}
                        className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
                      >
                        <span className="text-sm text-secondary-900">
                          {report.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(report.periodEnd)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
