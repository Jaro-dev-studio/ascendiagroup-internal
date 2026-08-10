"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CircleCheckBig,
  ExternalLink,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  pushMeetingActionsToBoard,
  summariseMeetingAction,
} from "@/lib/actions/meetings";
import { formatDate, titleCase } from "@/lib/utils";

interface MeetingDetail {
  id: string;
  title: string;
  type: string;
  occurredAt: Date;
  durationMinutes: number | null;
  attendees: string[];
  transcript: string | null;
  summary: string | null;
  nextSteps: string | null;
  recordingUrl: string | null;
  source: string;
  summarizedAt: Date | null;
  client: { id: string; name: string };
  createdBy: { name: string | null; email: string } | null;
  actionItems: {
    id: string;
    title: string;
    owner: string | null;
    taskId: string | null;
  }[];
}

export function MeetingDetailClient({
  meeting,
  isClaudeConnected,
}: {
  meeting: MeetingDetail;
  isClaudeConnected: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSummarising, setIsSummarising] = useState(false);

  async function onSummarise() {
    setIsSummarising(true);
    try {
      const { error } = await summariseMeetingAction(meeting.id);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Summary generated.");
      router.refresh();
    } finally {
      setIsSummarising(false);
    }
  }

  function onPushActions() {
    startTransition(async () => {
      const { data, error } = await pushMeetingActionsToBoard(meeting.id);
      if (error || !data) {
        toast.error(error ?? "Something went wrong.");
        return;
      }
      toast.success(`Created ${data.created} tasks.`);
      router.refresh();
    });
  }

  const pendingActions = meeting.actionItems.filter((item) => !item.taskId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={meeting.title}
        description={`${meeting.client.name} · ${titleCase(meeting.type)} · ${formatDate(
          meeting.occurredAt
        )}${meeting.durationMinutes ? ` · ${meeting.durationMinutes} min` : ""}`}
        actions={
          <>
            {meeting.recordingUrl && (
              <Button asChild variant="outline">
                <a href={meeting.recordingUrl} target="_blank" rel="noreferrer">
                  Recording
                  <ExternalLink className="ml-2 size-3.5" />
                </a>
              </Button>
            )}
            <Button
              onClick={onSummarise}
              disabled={
                isSummarising || !meeting.transcript || !isClaudeConnected
              }
            >
              {isSummarising ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}
              {meeting.summary ? "Regenerate summary" : "Summarise with Claude"}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Link
          href={`/dashboard/clients/${meeting.client.id}`}
          className="text-primary hover:underline"
        >
          {meeting.client.name}
        </Link>
        <Badge variant="secondary">{titleCase(meeting.source)}</Badge>
        {meeting.attendees.length > 0 && (
          <span>Attendees: {meeting.attendees.join(", ")}</span>
        )}
        {meeting.createdBy && (
          <span>Logged by {meeting.createdBy.name ?? meeting.createdBy.email}</span>
        )}
      </div>

      {!isClaudeConnected && (
        <p className="rounded-md border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Connect Claude under Integrations to generate summaries and action items.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {meeting.summary ? (
                <p className="whitespace-pre-wrap text-sm text-secondary-700">
                  {meeting.summary}
                </p>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {meeting.transcript
                    ? "Generate a summary to extract the recap, next steps and action items."
                    : "Add a transcript to this call before generating a summary."}
                </p>
              )}
            </CardContent>
          </Card>

          {meeting.nextSteps && (
            <Card>
              <CardHeader>
                <CardTitle>Next steps</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-secondary-700">
                  {meeting.nextSteps}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              {meeting.transcript ? (
                <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-sm text-secondary-700 scrollbar-thin">
                  {meeting.transcript}
                </pre>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No transcript stored for this call.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Action items</CardTitle>
            {pendingActions.length > 0 && (
              <Button size="sm" onClick={onPushActions} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                ) : (
                  <Send className="mr-2 size-3.5" />
                )}
                To board
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {meeting.actionItems.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Action items appear here once the call is summarised.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {meeting.actionItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-secondary-900">{item.title}</p>
                      {item.owner && (
                        <p className="text-xs text-muted-foreground">
                          {item.owner}
                        </p>
                      )}
                    </div>
                    {item.taskId && (
                      <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-accent-600" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
