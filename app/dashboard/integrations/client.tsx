"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CircleCheckBig,
  Copy,
  ExternalLink,
  Loader2,
  Plug,
  RefreshCw,
  TriangleAlert,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { INTEGRATIONS, type IntegrationDefinition } from "@/config/integrations";
import {
  connectIntegration,
  removeIntegration,
  retestIntegration,
} from "@/lib/actions/integrations";
import type { IntegrationSummary } from "@/lib/fetchers/integrations";
import { formatRelative } from "@/lib/utils";

const CATEGORIES: IntegrationDefinition["category"][] = [
  "Core",
  "Delivery",
  "Marketing data",
];

export function IntegrationsClient({
  integrations,
  error,
}: {
  integrations: IntegrationSummary[];
  error: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const summaryByProvider = new Map(
    integrations.map((integration) => [integration.provider, integration])
  );

  const activeDefinition = INTEGRATIONS.find(
    (definition) => definition.provider === activeProvider
  );

  function openConnect(definition: IntegrationDefinition) {
    setActiveProvider(definition.provider);
    setValues(
      Object.fromEntries(definition.fields.map((field) => [field.key, ""]))
    );
  }

  async function onConnect(event: React.FormEvent) {
    event.preventDefault();
    if (!activeDefinition) return;

    setIsSaving(true);
    try {
      const { data, error: connectError } = await connectIntegration({
        provider: activeDefinition.provider,
        credentials: values,
      });

      if (connectError || !data) {
        toast.error(connectError ?? "Could not connect.");
        return;
      }

      toast.success(data.message);
      setActiveProvider(null);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  function onRetest(provider: string) {
    startTransition(async () => {
      const { data, error: testError } = await retestIntegration(provider);
      if (testError) toast.error(testError);
      else toast.success(data?.message ?? "Connection healthy.");
      router.refresh();
    });
  }

  function onDisconnect(provider: string) {
    startTransition(async () => {
      const { error: removeError } = await removeIntegration(provider);
      if (removeError) toast.error(removeError);
      else {
        toast.success("Integration disconnected.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Integrations"
        description="Connect the tools that feed onboarding, delivery and reporting. Credentials are encrypted before they are stored."
      />

      {error && (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </p>
      )}

      {CATEGORIES.map((category) => {
        const definitions = INTEGRATIONS.filter(
          (definition) => definition.category === category
        );

        return (
          <section key={category} className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-secondary-500">
              {category}
            </h2>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {definitions.map((definition) => {
                const summary = summaryByProvider.get(definition.provider);
                const isConnected = summary?.status === "CONNECTED";
                const hasError = summary?.status === "ERROR";

                return (
                  <Card key={definition.provider}>
                    <CardHeader className="flex-row items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle>{definition.name}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {definition.summary}
                        </p>
                      </div>
                      <Badge
                        variant={
                          isConnected
                            ? "success"
                            : hasError
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {isConnected ? (
                          <CircleCheckBig className="size-3" />
                        ) : hasError ? (
                          <TriangleAlert className="size-3" />
                        ) : null}
                        {isConnected
                          ? "Connected"
                          : hasError
                            ? "Error"
                            : "Not connected"}
                      </Badge>
                    </CardHeader>

                    <CardContent className="flex flex-col gap-4">
                      <ul className="flex flex-col gap-1.5">
                        {definition.capabilities.map((capability) => (
                          <li
                            key={capability}
                            className="flex items-start gap-2 text-xs text-secondary-600"
                          >
                            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                            {capability}
                          </li>
                        ))}
                      </ul>

                      {summary?.accountLabel && (
                        <p className="rounded-md bg-muted px-3 py-2 text-xs text-secondary-700">
                          Account: {summary.accountLabel}
                          {summary.lastCheckedAt
                            ? ` · checked ${formatRelative(summary.lastCheckedAt)}`
                            : ""}
                        </p>
                      )}

                      {summary?.lastError && (
                        <p className="rounded-md bg-danger-50 px-3 py-2 text-xs text-danger-700">
                          {summary.lastError}
                        </p>
                      )}

                      {Object.keys(summary?.maskedValues ?? {}).length > 0 && (
                        <dl className="flex flex-col gap-1 text-xs">
                          {definition.fields
                            .filter((field) => summary?.maskedValues[field.key])
                            .map((field) => (
                              <div
                                key={field.key}
                                className="flex items-center justify-between gap-3"
                              >
                                <dt className="text-muted-foreground">
                                  {field.label}
                                </dt>
                                <dd className="truncate font-mono text-secondary-700">
                                  {summary?.maskedValues[field.key]}
                                </dd>
                              </div>
                            ))}
                        </dl>
                      )}

                      {definition.webhookPath && isConnected && (
                        <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-secondary-700">
                            {definition.webhookPath}
                            {summary?.webhookToken
                              ? `?token=${summary.webhookToken}`
                              : ""}
                          </span>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Copy webhook URL"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `${window.location.origin}${definition.webhookPath}${
                                  summary?.webhookToken
                                    ? `?token=${summary.webhookToken}`
                                    : ""
                                }`
                              );
                              toast.success("Webhook URL copied.");
                            }}
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={() => openConnect(definition)}>
                          <Plug className="mr-2 size-3.5" />
                          {isConnected || hasError ? "Update keys" : "Connect"}
                        </Button>

                        {(isConnected || hasError) && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isPending}
                              onClick={() => onRetest(definition.provider)}
                            >
                              <RefreshCw className="mr-2 size-3.5" />
                              Test
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isPending}
                              onClick={() => onDisconnect(definition.provider)}
                            >
                              <Unplug className="mr-2 size-3.5" />
                              Disconnect
                            </Button>
                          </>
                        )}

                        <a
                          href={definition.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                        >
                          API docs
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}

      <Dialog
        open={activeProvider !== null}
        onOpenChange={(open) => !open && setActiveProvider(null)}
      >
        <DialogContent className="scrollbar-thin max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Connect {activeDefinition?.name}</DialogTitle>
            <DialogDescription>
              We call the provider API with these credentials before saving, so you
              know immediately whether the connection works.
            </DialogDescription>
          </DialogHeader>

          {activeDefinition && (
            <form onSubmit={onConnect} className="flex flex-col gap-4">
              {activeDefinition.fields.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={field.key}>
                    {field.label}
                    {field.required && <span className="text-danger-600"> *</span>}
                  </Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={field.key}
                      rows={5}
                      value={values[field.key] ?? ""}
                      onChange={(event) =>
                        setValues({ ...values, [field.key]: event.target.value })
                      }
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <Input
                      id={field.key}
                      type={field.type === "password" ? "password" : "text"}
                      value={values[field.key] ?? ""}
                      onChange={(event) =>
                        setValues({ ...values, [field.key]: event.target.value })
                      }
                      placeholder={field.placeholder}
                    />
                  )}
                  {field.help && (
                    <p className="text-xs text-muted-foreground">{field.help}</p>
                  )}
                </div>
              ))}

              <DialogFooter className="flex-row justify-end gap-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Test and save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setActiveProvider(null)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
