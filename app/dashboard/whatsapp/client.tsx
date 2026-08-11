"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, MessageCircle, Plus, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  assignWhatsAppMessage,
  captureWhatsAppMessage,
  deleteWhatsAppMessage,
} from "@/lib/actions/whatsapp";
import { formatDateTime } from "@/lib/utils";

interface MessageRow {
  id: string;
  direction: string;
  fromNumber: string;
  senderName: string | null;
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  sentAt: Date;
  client: { id: string; name: string } | null;
}

export function WhatsAppClient({
  messages,
  clients,
  error,
  activeClientId,
  verifyToken,
}: {
  messages: MessageRow[];
  clients: { id: string; name: string }[];
  error: string | null;
  activeClientId: string;
  verifyToken: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [values, setValues] = useState({
    clientId: activeClientId,
    senderName: "",
    fromNumber: "",
    body: "",
    sentAt: new Date().toISOString().slice(0, 16),
  });

  const unassigned = messages.filter((message) => !message.client);

  async function onCapture(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const { error: captureError } = await captureWhatsAppMessage(values);
      if (captureError) {
        toast.error(captureError);
        return;
      }

      toast.success("Message captured into the knowledge base.");
      setIsOpen(false);
      setValues({ ...values, body: "", senderName: "", fromNumber: "" });
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  function onAssign(messageId: string, clientId: string) {
    startTransition(async () => {
      const { error: assignError } = await assignWhatsAppMessage({
        messageId,
        clientId,
      });
      if (assignError) toast.error(assignError);
      else {
        toast.success("Message filed against the client.");
        router.refresh();
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const { error: deleteError } = await deleteWhatsAppMessage(id);
      if (deleteError) toast.error(deleteError);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="WhatsApp capture"
        description="Client conversations filed against the right practice and added to their knowledge base."
        actions={
          <>
            {verifyToken && (
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/api/webhooks/whatsapp`
                  );
                  toast.success("Webhook URL copied. Use it in the Meta console.");
                }}
              >
                <Webhook className="mr-2 size-4" />
                Webhook URL
              </Button>
            )}
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="mr-2 size-4" />
              Capture message
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
                ? "/dashboard/whatsapp"
                : `/dashboard/whatsapp?clientId=${value}`
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

      {unassigned.length > 0 && (
        <div className="rounded-md border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          {unassigned.length} message(s) arrived from a number that does not match
          any client. Assign them below, or add the number to the client record so
          future messages file themselves.
        </div>
      )}

      {messages.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No WhatsApp messages yet"
          description="Point the WhatsApp Business webhook at this workspace, or paste important messages in by hand so they are searchable."
          action={
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="mr-2 size-4" />
              Capture a message
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-secondary-900">
                    {message.senderName ?? message.fromNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(message.sentAt)} · {message.fromNumber}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={
                      message.direction === "INBOUND" ? "secondary" : "default"
                    }
                  >
                    {message.direction === "INBOUND" ? "Inbound" : "Outbound"}
                  </Badge>
                  {message.client ? (
                    <Badge variant="success">{message.client.name}</Badge>
                  ) : (
                    <Select
                      onValueChange={(value) => onAssign(message.id, value)}
                      disabled={isPending}
                    >
                      <SelectTrigger className="h-8 w-44 text-xs">
                        <SelectValue placeholder="Assign to client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete message"
                    disabled={isPending}
                    onClick={() => onDelete(message.id)}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5 text-danger-600" />
                  </Button>
                </div>
              </div>

              <p className="whitespace-pre-wrap text-sm text-secondary-700">
                {message.body ?? `(${message.mediaType ?? "media"} attachment)`}
              </p>

              {message.mediaUrl && (
                <a
                  href={message.mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Open attachment
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Capture a WhatsApp message</DialogTitle>
            <DialogDescription>
              Adds the message to the client timeline and their searchable knowledge
              base.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onCapture} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client">Client</Label>
              <Select
                value={values.clientId}
                onValueChange={(value) => setValues({ ...values, clientId: value })}
              >
                <SelectTrigger id="client">
                  <SelectValue placeholder="Choose a client" />
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="senderName">Sender</Label>
                <Input
                  id="senderName"
                  value={values.senderName}
                  onChange={(event) =>
                    setValues({ ...values, senderName: event.target.value })
                  }
                  placeholder="Dr Patel"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fromNumber">Number</Label>
                <Input
                  id="fromNumber"
                  value={values.fromNumber}
                  onChange={(event) =>
                    setValues({ ...values, fromNumber: event.target.value })
                  }
                  placeholder="+441234567890"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sentAt">Sent at</Label>
              <Input
                id="sentAt"
                type="datetime-local"
                value={values.sentAt}
                onChange={(event) =>
                  setValues({ ...values, sentAt: event.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                rows={5}
                value={values.body}
                onChange={(event) =>
                  setValues({ ...values, body: event.target.value })
                }
                required
              />
            </div>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Capture
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                disabled={isSaving}
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
