"use client";

import { useState } from "react";
import { Bell, Building2, AlertCircle, Hash, CheckCircle2, Send, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateNotificationConfig, testNotification } from "@/lib/actions";
import {
  ClientNotificationSettings,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_DESCRIPTIONS,
  ALL_EVENT_TYPES,
  SlackNotificationEventType,
} from "@/lib/slack-notification-constants";

interface NotificationsClientProps {
  initialSettings: ClientNotificationSettings[];
}

export function NotificationsClient({ initialSettings }: NotificationsClientProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [selectedClientId, setSelectedClientId] = useState<string>(
    initialSettings.length > 0 ? initialSettings[0].clientCompanyId : ""
  );
  const [updating, setUpdating] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ key: string; success: boolean; message: string } | null>(null);

  const selectedClient = settings.find((s) => s.clientCompanyId === selectedClientId);

  const getConfigForEvent = (
    clientConfigs: ClientNotificationSettings["configs"],
    eventType: SlackNotificationEventType
  ) => {
    return clientConfigs.find((c) => c.eventType === eventType);
  };

  const handleToggle = async (
    clientCompanyId: string,
    eventType: SlackNotificationEventType,
    channel: "public" | "internal",
    currentValue: boolean
  ) => {
    const key = `${clientCompanyId}-${eventType}-${channel}`;
    setUpdating(key);

    const clientSetting = settings.find((s) => s.clientCompanyId === clientCompanyId);
    if (!clientSetting) return;

    const existingConfig = getConfigForEvent(clientSetting.configs, eventType);
    
    const sendToPublic = channel === "public" ? !currentValue : (existingConfig?.sendToPublic ?? false);
    const sendToInternal = channel === "internal" ? !currentValue : (existingConfig?.sendToInternal ?? false);

    const result = await updateNotificationConfig(
      clientCompanyId,
      eventType,
      sendToPublic,
      sendToInternal
    );

    if (result.data) {
      setSettings((prev) =>
        prev.map((s) => {
          if (s.clientCompanyId !== clientCompanyId) return s;

          const configIndex = s.configs.findIndex((c) => c.eventType === eventType);
          if (configIndex >= 0) {
            const newConfigs = [...s.configs];
            newConfigs[configIndex] = result.data!;
            return { ...s, configs: newConfigs };
          } else {
            return { ...s, configs: [...s.configs, result.data!] };
          }
        })
      );
    }

    setUpdating(null);
  };

  const handleTest = async (
    clientCompanyId: string,
    eventType: SlackNotificationEventType
  ) => {
    const key = `${clientCompanyId}-${eventType}`;
    setTesting(key);
    setTestResult(null);

    const result = await testNotification(clientCompanyId, eventType);

    if (result.error) {
      setTestResult({ key, success: false, message: result.error });
    } else if (result.data) {
      setTestResult({ key, success: true, message: result.data.message });
    }

    setTesting(null);

    setTimeout(() => {
      setTestResult((prev) => (prev?.key === key ? null : prev));
    }, 5000);
  };

  const getActiveCount = (configs: ClientNotificationSettings["configs"]) => {
    return configs.filter((c) => c.sendToPublic || c.sendToInternal).length;
  };

  if (settings.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Slack Notifications</h1>
          <p className="text-secondary-600">
            Configure which Slack notifications are sent for each client
          </p>
        </div>
        <Card className="p-8 text-center">
          <Building2 className="mx-auto size-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">No clients yet</h3>
          <p className="mt-2 text-secondary-600">
            Create clients first to configure notifications
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Slack Notifications</h1>
          <p className="text-secondary-600">
            Configure which Slack notifications are sent for each client
          </p>
        </div>
      </div>

      {/* Client Selector */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium text-secondary-700">Select Client:</Label>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            {settings.map((client) => (
              <SelectItem key={client.clientCompanyId} value={client.clientCompanyId}>
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-secondary-500" />
                  <span>{client.clientName}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {getActiveCount(client.configs)}/{ALL_EVENT_TYPES.length}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selected Client Notifications */}
      {selectedClient && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                  <Building2 className="size-5 text-primary-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">{selectedClient.clientName}</CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-4">
                    {selectedClient.slackPublicChannelId ? (
                      <span className="flex items-center gap-1 text-xs">
                        <Hash className="size-3" />
                        Public: <code className="rounded bg-secondary-100 px-1">{selectedClient.slackPublicChannelId}</code>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-warning-600">
                        <AlertCircle className="size-3" />
                        No public channel
                      </span>
                    )}
                    {selectedClient.slackInternalChannelId ? (
                      <span className="flex items-center gap-1 text-xs">
                        <Hash className="size-3" />
                        Internal: <code className="rounded bg-secondary-100 px-1">{selectedClient.slackInternalChannelId}</code>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-warning-600">
                        <AlertCircle className="size-3" />
                        No internal channel
                      </span>
                    )}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Bell className="size-3" />
                {getActiveCount(selectedClient.configs)} / {ALL_EVENT_TYPES.length} active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-secondary-100">
              {ALL_EVENT_TYPES.map((eventType) => {
                const config = getConfigForEvent(selectedClient.configs, eventType);
                const sendToPublic = config?.sendToPublic ?? false;
                const sendToInternal = config?.sendToInternal ?? false;
                const publicKey = `${selectedClient.clientCompanyId}-${eventType}-public`;
                const internalKey = `${selectedClient.clientCompanyId}-${eventType}-internal`;

                return (
                  <div
                    key={eventType}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-secondary-900">
                          {EVENT_TYPE_LABELS[eventType]}
                        </span>
                        {(sendToPublic || sendToInternal) && (
                          <CheckCircle2 className="size-4 text-success-600" />
                        )}
                      </div>
                      <p className="text-sm text-secondary-500">
                        {EVENT_TYPE_DESCRIPTIONS[eventType]}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      {!selectedClient.slackPublicChannelId ? (
                        <Tooltip content="Configure public Slack channel first">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={publicKey}
                              className="text-sm text-secondary-400"
                            >
                              Public
                            </Label>
                            <Switch
                              id={publicKey}
                              checked={sendToPublic}
                              disabled={true}
                            />
                          </div>
                        </Tooltip>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor={publicKey}
                            className="text-sm text-secondary-700"
                          >
                            Public
                          </Label>
                          <Switch
                            id={publicKey}
                            checked={sendToPublic}
                            disabled={updating === publicKey}
                            onCheckedChange={() =>
                              handleToggle(
                                selectedClient.clientCompanyId,
                                eventType,
                                "public",
                                sendToPublic
                              )
                            }
                          />
                        </div>
                      )}

                      {!selectedClient.slackInternalChannelId ? (
                        <Tooltip content="Configure internal Slack channel first">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={internalKey}
                              className="text-sm text-secondary-400"
                            >
                              Internal
                            </Label>
                            <Switch
                              id={internalKey}
                              checked={sendToInternal}
                              disabled={true}
                            />
                          </div>
                        </Tooltip>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor={internalKey}
                            className="text-sm text-secondary-700"
                          >
                            Internal
                          </Label>
                          <Switch
                            id={internalKey}
                            checked={sendToInternal}
                            disabled={updating === internalKey}
                            onCheckedChange={() =>
                              handleToggle(
                                selectedClient.clientCompanyId,
                                eventType,
                                "internal",
                                sendToInternal
                              )
                            }
                          />
                        </div>
                      )}

                      {/* Test Button */}
                      {(sendToPublic || sendToInternal) && (
                        <div className="flex items-center gap-2">
                          {testResult?.key === `${selectedClient.clientCompanyId}-${eventType}` ? (
                            <span
                              className={`text-xs ${
                                testResult.success ? "text-success-600" : "text-danger-600"
                              }`}
                            >
                              {testResult.message}
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={testing === `${selectedClient.clientCompanyId}-${eventType}`}
                              onClick={() => handleTest(selectedClient.clientCompanyId, eventType)}
                              className="h-7 gap-1 text-xs"
                            >
                              {testing === `${selectedClient.clientCompanyId}-${eventType}` ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Send className="size-3" />
                              )}
                              Test
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
