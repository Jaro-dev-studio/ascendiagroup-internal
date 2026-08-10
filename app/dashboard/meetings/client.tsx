"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Loader2, Mic, Plus, Webhook } from "lucide-react";
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
import { saveMeeting } from "@/lib/actions/meetings";
import { formatDate, titleCase } from "@/lib/utils";

interface MeetingRow {
  id: string;
  title: string;
  type: string;
  occurredAt: Date;
  summary: string | null;
  transcript: string | null;
  source: string;
  client: { id: string; name: string };
  _count: { actionItems: number };
}

const TYPES = [
  "SALES_CALL",
  "ONBOARDING_CALL",
  "STRATEGY_CALL",
  "CHECK_IN",
  "OTHER",
];

export function MeetingsClient({
  meetings,
  clients,
  error,
  activeClientId,
  webhookToken,
}: {
  meetings: MeetingRow[];
  clients: { id: string; name: string }[];
  error: string | null;
  activeClientId: string;
  webhookToken: string | null;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [values, setValues] = useState({
    clientId: activeClientId,
    title: "",
    type: "SALES_CALL",
    occurredAt: new Date().toISOString().slice(0, 10),
    durationMinutes: "",
    attendees: "",
    recordingUrl: "",
    transcript: "",
  });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const { data, error: saveError } = await saveMeeting(values);
      if (saveError || !data) {
        toast.error(saveError ?? "Something went wrong.");
        return;
      }

      toast.success("Call saved.");
      setIsOpen(false);
      router.push(`/dashboard/meetings/${data.id}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calls and transcripts"
        description="Sales and strategy calls with Claude-generated summaries, next steps and action items."
        actions={
          <>
            {webhookToken && (
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/api/webhooks/call-recording?token=${webhookToken}`
                  );
                  toast.success("Recorder webhook URL copied.");
                }}
              >
                <Webhook className="mr-2 size-4" />
                Webhook URL
              </Button>
            )}
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="mr-2 size-4" />
              Log a call
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
                ? "/dashboard/meetings"
                : `/dashboard/meetings?clientId=${value}`
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

      {meetings.length === 0 ? (
        <EmptyState
          icon={Mic}
          title="No calls logged"
          description="Paste a transcript from your recorder, or connect the call recording webhook so calls arrive here automatically."
          action={
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="mr-2 size-4" />
              Log a call
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {meetings.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/dashboard/meetings/${meeting.id}`}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-secondary-900">
                    {meeting.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {meeting.client.name} · {titleCase(meeting.type)} ·{" "}
                    {formatDate(meeting.occurredAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {meeting.summary ? (
                    <Badge variant="success">Summarised</Badge>
                  ) : meeting.transcript ? (
                    <Badge variant="warning">Needs summary</Badge>
                  ) : (
                    <Badge variant="secondary">No transcript</Badge>
                  )}
                  {meeting._count.actionItems > 0 && (
                    <Badge variant="outline">
                      {meeting._count.actionItems} actions
                    </Badge>
                  )}
                </div>
              </div>

              {meeting.summary && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {meeting.summary}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>Log a call</DialogTitle>
            <DialogDescription>
              Paste the transcript and Claude will draft the summary, next steps and
              action items.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client">Client</Label>
                <Select
                  value={values.clientId}
                  onValueChange={(value) =>
                    setValues({ ...values, clientId: value })
                  }
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

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="type">Call type</Label>
                <Select
                  value={values.type}
                  onValueChange={(value) => setValues({ ...values, type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {titleCase(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={values.title}
                onChange={(event) =>
                  setValues({ ...values, title: event.target.value })
                }
                placeholder="Discovery call with Dr Patel"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="occurredAt">Date</Label>
                <Input
                  id="occurredAt"
                  type="date"
                  value={values.occurredAt}
                  onChange={(event) =>
                    setValues({ ...values, occurredAt: event.target.value })
                  }
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="duration">Duration (min)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="0"
                  value={values.durationMinutes}
                  onChange={(event) =>
                    setValues({ ...values, durationMinutes: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="attendees">Attendees</Label>
                <Input
                  id="attendees"
                  value={values.attendees}
                  onChange={(event) =>
                    setValues({ ...values, attendees: event.target.value })
                  }
                  placeholder="Comma separated"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recordingUrl">Recording URL</Label>
              <Input
                id="recordingUrl"
                value={values.recordingUrl}
                onChange={(event) =>
                  setValues({ ...values, recordingUrl: event.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="transcript">Transcript</Label>
              <Textarea
                id="transcript"
                rows={10}
                value={values.transcript}
                onChange={(event) =>
                  setValues({ ...values, transcript: event.target.value })
                }
                placeholder="Paste the full transcript here."
              />
            </div>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save call
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
