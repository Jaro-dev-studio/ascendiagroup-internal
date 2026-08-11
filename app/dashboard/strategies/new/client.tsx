"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { generateStrategyAction } from "@/lib/actions/strategies";
import { cn, formatDate, titleCase } from "@/lib/utils";

interface Sources {
  submissions: {
    id: string;
    submittedAt: Date | null;
    form: { name: string };
    _count: { answers: number };
  }[];
  meetings: { id: string; title: string; type: string; occurredAt: Date }[];
}

export function NewStrategyClient({
  clients,
  defaultClientId,
  initialSources,
  isClaudeConnected,
}: {
  clients: { id: string; name: string }[];
  defaultClientId: string;
  initialSources: Sources | null;
  isClaudeConnected: boolean;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(defaultClientId);
  const [submissionId, setSubmissionId] = useState("");
  const [meetingIds, setMeetingIds] = useState<string[]>([]);
  const [extraContext, setExtraContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const hasSources =
    (initialSources?.submissions.length ?? 0) +
      (initialSources?.meetings.length ?? 0) >
    0;

  function onSelectClient(value: string) {
    setClientId(value);
    setSubmissionId("");
    setMeetingIds([]);
    router.push(`/dashboard/strategies/new?clientId=${value}`);
  }

  function toggleMeeting(id: string) {
    setMeetingIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  async function onGenerate(event: React.FormEvent) {
    event.preventDefault();
    if (!clientId) {
      toast.error("Choose a client first.");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await generateStrategyAction({
        clientId,
        submissionId: submissionId || undefined,
        meetingIds,
        extraContext,
      });

      if (error || !data) {
        toast.error(error ?? "Something went wrong.");
        return;
      }

      toast.success("Strategy generated.");
      router.push(`/dashboard/strategies/${data.id}`);
    } finally {
      setIsGenerating(false);
    }
  }

  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Add a client before generating a strategy.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/clients/new">Add client</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onGenerate} className="flex flex-col gap-6">
      {!isClaudeConnected && (
        <div className="flex items-start gap-3 rounded-md border border-warning-100 bg-warning-50 px-4 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-600" />
          <div className="text-sm text-warning-700">
            <p className="font-medium">Claude is not connected</p>
            <p className="mt-0.5">
              Add an Anthropic API key under{" "}
              <Link href="/dashboard/integrations" className="underline">
                Integrations
              </Link>{" "}
              before generating a strategy.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Client</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={clientId} onValueChange={onSelectClient}>
            <SelectTrigger>
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
        </CardContent>
      </Card>

      {clientId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Sources</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {!hasSources && (
                <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
                  This client has no completed intake form or transcribed call yet.
                  You can still generate from the extra context below, but the plan
                  will be thinner.
                </p>
              )}

              {initialSources && initialSources.submissions.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Label>Onboarding submission</Label>
                  <div className="flex flex-col gap-2">
                    {initialSources.submissions.map((submission) => (
                      <button
                        key={submission.id}
                        type="button"
                        onClick={() =>
                          setSubmissionId(
                            submissionId === submission.id ? "" : submission.id
                          )
                        }
                        className={cn(
                          "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                          submissionId === submission.id
                            ? "border-primary bg-primary-50"
                            : "border-border bg-card hover:bg-muted"
                        )}
                      >
                        <span className="text-secondary-900">
                          {submission.form.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {submission._count.answers} answers ·{" "}
                          {formatDate(submission.submittedAt)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {initialSources && initialSources.meetings.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Label>Call transcripts</Label>
                  <div className="flex flex-col gap-2">
                    {initialSources.meetings.map((meeting) => (
                      <button
                        key={meeting.id}
                        type="button"
                        onClick={() => toggleMeeting(meeting.id)}
                        className={cn(
                          "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                          meetingIds.includes(meeting.id)
                            ? "border-primary bg-primary-50"
                            : "border-border bg-card hover:bg-muted"
                        )}
                      >
                        <span className="text-secondary-900">{meeting.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {titleCase(meeting.type)} ·{" "}
                          {formatDate(meeting.occurredAt)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="extraContext">Extra context</Label>
                <Textarea
                  id="extraContext"
                  rows={5}
                  value={extraContext}
                  onChange={(event) => setExtraContext(event.target.value)}
                  placeholder="Anything else Claude should know: competitor pressure, budget constraints, launch dates..."
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isGenerating || !isClaudeConnected}>
              {isGenerating ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}
              Generate roadmap
            </Button>
            {isGenerating && (
              <span className="text-sm text-muted-foreground">
                Claude is reading your sources, this usually takes under a minute.
              </span>
            )}
          </div>
        </>
      )}
    </form>
  );
}
