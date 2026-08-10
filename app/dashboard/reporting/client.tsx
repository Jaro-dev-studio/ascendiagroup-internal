"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ChartColumn,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { BarChart } from "@/components/shared/bar-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { setClientIntegrationLink } from "@/lib/actions/clients";
import { deleteReport, publishReport, saveReport } from "@/lib/actions/reports";
import { refreshClientMetrics } from "@/lib/actions/workspace";
import { formatDate, formatNumber, titleCase } from "@/lib/utils";

interface Metric {
  id: string;
  provider: string;
  metricKey: string;
  label: string;
  value: number;
  unit: string | null;
  periodStart: Date;
  periodEnd: Date;
  client: { id: string; name: string };
}

interface Report {
  id: string;
  title: string;
  type: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  summary: string | null;
  highlights: string[];
  client: { id: string; name: string };
}

const REPORT_TYPES = ["WEEKLY", "MONTHLY"];

const LINKABLE_PROVIDERS = [
  { value: "AGENCY_ANALYTICS", label: "AgencyAnalytics campaign ID" },
  { value: "GOOGLE_ADS", label: "Google Ads customer ID" },
  { value: "GOOGLE_BUSINESS_PROFILE", label: "Business Profile location ID" },
  { value: "GOHIGHLEVEL", label: "GoHighLevel location ID" },
];

export function ReportingClient({
  clients,
  metrics,
  reports,
  links,
  activeClientId,
  error,
}: {
  clients: { id: string; name: string; website: string | null; status: string }[];
  metrics: Metric[];
  reports: Report[];
  links: { id: string; clientId: string; provider: string; externalId: string }[];
  activeClientId: string;
  error: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [linkValues, setLinkValues] = useState({
    clientId: activeClientId || clients[0]?.id || "",
    provider: "AGENCY_ANALYTICS",
    externalId: "",
  });
  const [reportValues, setReportValues] = useState({
    clientId: activeClientId || clients[0]?.id || "",
    title: "",
    type: "MONTHLY",
    periodStart: "",
    periodEnd: "",
    summary: "",
    highlights: "",
  });

  const latestMetrics = metrics.filter(
    (metric, index, all) =>
      all.findIndex(
        (item) =>
          item.metricKey === metric.metricKey && item.client.id === metric.client.id
      ) === index
  );

  function onSyncMetrics(clientId: string) {
    startTransition(async () => {
      const { data, error: syncError } = await refreshClientMetrics(clientId);
      if (syncError) {
        toast.error(syncError);
        return;
      }
      if (data && data.count === 0) {
        toast.message(
          data.errors.length > 0
            ? data.errors[0]
            : "No metrics returned. Check the connected accounts for this client."
        );
      } else {
        toast.success(`Stored ${data?.count ?? 0} metrics.`);
      }
      router.refresh();
    });
  }

  async function onSaveReport(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const { error: saveError } = await saveReport({
        ...reportValues,
        highlights: reportValues.highlights
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      });

      if (saveError) {
        toast.error(saveError);
        return;
      }

      toast.success("Report saved.");
      setIsReportOpen(false);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function onSaveLink(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const { error: linkError } = await setClientIntegrationLink(linkValues);
      if (linkError) {
        toast.error(linkError);
        return;
      }
      toast.success("Reporting account linked.");
      setIsLinkOpen(false);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reporting"
        description="Campaign KPIs pulled from the connected marketing platforms, plus the weekly and monthly reports you publish to clients."
        actions={
          <>
            <Button variant="outline" onClick={() => setIsLinkOpen(true)}>
              <Link2 className="mr-2 size-4" />
              Link account
            </Button>
            <Button
              onClick={() => setIsReportOpen(true)}
              disabled={clients.length === 0}
            >
              <Plus className="mr-2 size-4" />
              New report
            </Button>
          </>
        }
      />

      <div className="w-full sm:max-w-xs">
        <Select
          value={activeClientId || "all"}
          onValueChange={(value) =>
            router.push(
              value === "all"
                ? "/dashboard/reporting"
                : `/dashboard/reporting?clientId=${value}`
            )
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </p>
      )}

      {clients.length === 0 ? (
        <EmptyState
          icon={ChartColumn}
          title="No active clients"
          description="Reporting pulls KPIs for active and onboarding practices. Add a client to get started."
          action={
            <Button asChild>
              <Link href="/dashboard/clients/new">Add client</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {clients
              .filter((client) => !activeClientId || client.id === activeClientId)
              .map((client) => {
                const clientMetrics = latestMetrics.filter(
                  (metric) => metric.client.id === client.id
                );
                const clientLinks = links.filter(
                  (link) => link.clientId === client.id
                );

                return (
                  <Card key={client.id}>
                    <CardHeader className="flex-row items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle>
                          <Link
                            href={`/dashboard/clients/${client.id}`}
                            className="hover:underline"
                          >
                            {client.name}
                          </Link>
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {clientLinks.length > 0
                            ? clientLinks
                              .map(
                                (link) =>
                                    `${titleCase(link.provider)}: ${link.externalId}`
                              )
                              .join(" · ")
                            : client.website
                              ? `SEMrush uses ${client.website}`
                              : "No reporting accounts linked"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => onSyncMetrics(client.id)}
                      >
                        <RefreshCw className="mr-1.5 size-3.5" />
                        Sync
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {clientMetrics.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          No KPIs stored yet. Link the client&apos;s campaign account
                          and press Sync.
                        </p>
                      ) : (
                        <>
                          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {clientMetrics.slice(0, 6).map((metric) => (
                              <div
                                key={metric.id}
                                className="rounded-md border border-border p-3"
                              >
                                <p className="text-xs text-muted-foreground">
                                  {metric.label}
                                </p>
                                <p className="mt-1 text-lg font-semibold tabular-nums text-secondary-900">
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
                          <BarChart
                            data={clientMetrics.slice(0, 6).map((metric) => ({
                              label: metric.label,
                              value: metric.value,
                            }))}
                          />
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Client reports</CardTitle>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No reports yet. Create one to summarise a period for the client
                  portal.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {reports.map((report) => (
                    <li
                      key={report.id}
                      className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-secondary-900">
                          {report.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {report.client.name} · {titleCase(report.type)} ·{" "}
                          {formatDate(report.periodStart)} to{" "}
                          {formatDate(report.periodEnd)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant={
                            report.status === "PUBLISHED" ? "success" : "secondary"
                          }
                        >
                          {titleCase(report.status)}
                        </Badge>
                        {report.status !== "PUBLISHED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() =>
                              startTransition(async () => {
                                const { error: publishError } = await publishReport(
                                  report.id
                                );
                                if (publishError) toast.error(publishError);
                                else {
                                  toast.success("Report published to the portal.");
                                  router.refresh();
                                }
                              })
                            }
                          >
                            <Send className="mr-1.5 size-3.5" />
                            Publish
                          </Button>
                        )}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Delete report"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(async () => {
                              const { error: deleteError } = await deleteReport(
                                report.id
                              );
                              if (deleteError) toast.error(deleteError);
                              else router.refresh();
                            })
                          }
                        >
                          <Trash2 className="size-3.5 text-danger-600" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="scrollbar-thin max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New report</DialogTitle>
            <DialogDescription>
              Published reports appear on the client status page.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSaveReport} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reportClient">Client</Label>
                <Select
                  value={reportValues.clientId}
                  onValueChange={(value) =>
                    setReportValues({ ...reportValues, clientId: value })
                  }
                >
                  <SelectTrigger id="reportClient">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reportType">Type</Label>
                <Select
                  value={reportValues.type}
                  onValueChange={(value) =>
                    setReportValues({ ...reportValues, type: value })
                  }
                >
                  <SelectTrigger id="reportType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {titleCase(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reportTitle">Title</Label>
              <Input
                id="reportTitle"
                value={reportValues.title}
                onChange={(event) =>
                  setReportValues({ ...reportValues, title: event.target.value })
                }
                placeholder="January performance"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="periodStart">Period start</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={reportValues.periodStart}
                  onChange={(event) =>
                    setReportValues({
                      ...reportValues,
                      periodStart: event.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="periodEnd">Period end</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={reportValues.periodEnd}
                  onChange={(event) =>
                    setReportValues({
                      ...reportValues,
                      periodEnd: event.target.value,
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reportSummary">Summary</Label>
              <Textarea
                id="reportSummary"
                rows={4}
                value={reportValues.summary}
                onChange={(event) =>
                  setReportValues({ ...reportValues, summary: event.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reportHighlights">Highlights (one per line)</Label>
              <Textarea
                id="reportHighlights"
                rows={4}
                value={reportValues.highlights}
                onChange={(event) =>
                  setReportValues({
                    ...reportValues,
                    highlights: event.target.value,
                  })
                }
              />
            </div>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save report
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsReportOpen(false)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isLinkOpen} onOpenChange={setIsLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link a reporting account</DialogTitle>
            <DialogDescription>
              Tells the sync which account inside a connected platform belongs to
              this client.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSaveLink} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="linkClient">Client</Label>
              <Select
                value={linkValues.clientId}
                onValueChange={(value) =>
                  setLinkValues({ ...linkValues, clientId: value })
                }
              >
                <SelectTrigger id="linkClient">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="linkProvider">Platform</Label>
              <Select
                value={linkValues.provider}
                onValueChange={(value) =>
                  setLinkValues({ ...linkValues, provider: value })
                }
              >
                <SelectTrigger id="linkProvider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINKABLE_PROVIDERS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="linkExternalId">Account ID</Label>
              <Input
                id="linkExternalId"
                value={linkValues.externalId}
                onChange={(event) =>
                  setLinkValues({ ...linkValues, externalId: event.target.value })
                }
                placeholder="Leave blank to remove the link"
              />
            </div>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save link
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsLinkOpen(false)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
