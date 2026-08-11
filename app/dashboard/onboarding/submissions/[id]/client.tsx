"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound, Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { processSubmission } from "@/lib/actions/onboarding";
import { formatDateTime } from "@/lib/utils";

interface SubmissionDetail {
  id: string;
  status: string;
  token: string;
  practiceName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  invitedAt: Date;
  submittedAt: Date | null;
  processedAt: Date | null;
  projectId: string | null;
  form: { id: string; name: string };
  client: { id: string; name: string } | null;
  answers: {
    id: string;
    label: string;
    section: string;
    value: string | null;
    values: string[];
    isCredential: boolean;
  }[];
}

export function SubmissionDetailClient({
  submission,
  clients,
}: {
  submission: SubmissionDetail;
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [showCredentials, setShowCredentials] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [clientId, setClientId] = useState(submission.client?.id ?? "");
  const [projectName, setProjectName] = useState(
    `${submission.practiceName ?? "Client"} onboarding`
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const sections = useMemo(() => {
    const grouped = new Map<string, SubmissionDetail["answers"]>();
    for (const answer of submission.answers) {
      const existing = grouped.get(answer.section) ?? [];
      existing.push(answer);
      grouped.set(answer.section, existing);
    }
    return Array.from(grouped.entries());
  }, [submission.answers]);

  async function onProcess(event: React.FormEvent) {
    event.preventDefault();
    setIsProcessing(true);

    try {
      const { data, error } = await processSubmission({
        submissionId: submission.id,
        clientId: clientId || undefined,
        projectName,
      });

      if (error || !data) {
        toast.error(error ?? "Something went wrong.");
        return;
      }

      toast.success(`Project created with ${data.taskCount} tasks.`);
      data.notes.forEach((note) => toast.message(note));
      setIsOpen(false);
      router.push(`/dashboard/projects/${data.projectId}`);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={submission.practiceName ?? "Onboarding submission"}
        description={`${submission.form.name} · ${
          submission.submittedAt
            ? `submitted ${formatDateTime(submission.submittedAt)}`
            : "awaiting response"
        }`}
        actions={
          submission.status === "SUBMITTED" ? (
            <Button onClick={() => setIsOpen(true)}>
              <Rocket className="mr-2 size-4" />
              Create project
            </Button>
          ) : submission.status === "PROCESSED" && submission.projectId ? (
            <Button asChild variant="outline">
              <Link href={`/dashboard/projects/${submission.projectId}`}>
                Open project
              </Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/onboarding/${submission.token}`
                );
                toast.success("Intake link copied.");
              }}
            >
              <Copy className="mr-2 size-4" />
              Copy intake link
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge kind="submission" value={submission.status} />
        {submission.client && (
          <Link
            href={`/dashboard/clients/${submission.client.id}`}
            className="text-sm text-primary hover:underline"
          >
            {submission.client.name}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Answers</CardTitle>
            {submission.answers.some((answer) => answer.isCredential) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCredentials((current) => !current)}
              >
                {showCredentials ? (
                  <EyeOff className="mr-2 size-4" />
                ) : (
                  <Eye className="mr-2 size-4" />
                )}
                {showCredentials ? "Hide" : "Reveal"} credentials
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {submission.answers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No answers yet. The practice has not completed the form.
              </p>
            ) : (
              <div className="flex flex-col gap-6">
                {sections.map(([section, answers]) => (
                  <div key={section} className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary-500">
                      {section}
                    </h3>
                    <dl className="flex flex-col divide-y divide-border">
                      {answers.map((answer) => (
                        <div
                          key={answer.id}
                          className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:gap-6"
                        >
                          <dt className="flex w-full items-start gap-1.5 text-sm text-muted-foreground sm:w-1/2">
                            {answer.isCredential && (
                              <KeyRound className="mt-0.5 size-3.5 shrink-0 text-warning-600" />
                            )}
                            {answer.label}
                          </dt>
                          <dd className="w-full text-sm text-secondary-900 sm:w-1/2">
                            {answer.isCredential && !showCredentials
                              ? "••••••••"
                              : answer.values.length
                                ? answer.values.join(", ")
                                : (answer.value ?? "—")}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="text-secondary-900">{submission.contactName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="break-all text-secondary-900">
                {submission.contactEmail ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-secondary-900">{submission.contactPhone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Invited</p>
              <p className="text-secondary-900">
                {formatDateTime(submission.invitedAt)}
              </p>
            </div>
            {submission.processedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Processed</p>
                <p className="text-secondary-900">
                  {formatDateTime(submission.processedAt)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scaffold delivery</DialogTitle>
            <DialogDescription>
              Creates the project, applies your onboarding task templates and seeds
              the client knowledge base with these answers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onProcess} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="processClient">Client</Label>
              <Select
                value={clientId || "new"}
                onValueChange={(value) => setClientId(value === "new" ? "" : value)}
              >
                <SelectTrigger id="processClient">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create a new client record</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="projectName">Project name</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                required
              />
            </div>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button type="submit" disabled={isProcessing}>
                {isProcessing && <Loader2 className="mr-2 size-4 animate-spin" />}
                Create project
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                disabled={isProcessing}
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
