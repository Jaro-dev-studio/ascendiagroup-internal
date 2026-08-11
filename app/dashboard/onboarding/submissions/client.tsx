"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, ExternalLink, Inbox, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { createSubmissionInvite } from "@/lib/actions/onboarding";
import { cn, formatDate } from "@/lib/utils";

interface SubmissionRow {
  id: string;
  status: string;
  token: string;
  practiceName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  invitedAt: Date;
  submittedAt: Date | null;
  form: { id: string; name: string };
  client: { id: string; name: string } | null;
  _count: { answers: number };
}

const STATUS_FILTERS = [
  { label: "All", value: "ALL" },
  { label: "Awaiting response", value: "INVITED" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Processed", value: "PROCESSED" },
];

export function SubmissionsClient({
  submissions,
  forms,
  clients,
  error,
  activeStatus,
  activeClientId,
}: {
  submissions: SubmissionRow[];
  forms: { id: string; name: string; fieldCount: number }[];
  clients: { id: string; name: string }[];
  error: string | null;
  activeStatus: string;
  activeClientId: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [formId, setFormId] = useState(forms[0]?.id ?? "");
  const [clientId, setClientId] = useState(activeClientId);
  const [practiceName, setPracticeName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  function applyFilter(status: string) {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (activeClientId) params.set("clientId", activeClientId);
    router.push(`/dashboard/onboarding/submissions?${params.toString()}`);
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!formId) {
      toast.error("Create an intake form first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error: inviteError } = await createSubmissionInvite({
        formId,
        clientId: clientId || undefined,
        practiceName: practiceName || undefined,
        contactEmail: contactEmail || undefined,
      });

      if (inviteError || !data) {
        toast.error(inviteError ?? "Something went wrong.");
        return;
      }

      const link = `${window.location.origin}/onboarding/${data.token}`;
      setInviteLink(link);
      navigator.clipboard.writeText(link).catch(() => undefined);
      toast.success("Intake link created and copied.");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Onboarding submissions"
        description="Every intake link you have sent, the answers received and whether delivery has been scaffolded."
        actions={
          <Button onClick={() => setIsOpen(true)}>
            <Send className="mr-2 size-4" />
            New intake link
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => applyFilter(filter.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              activeStatus === filter.value
                ? "border-primary bg-primary-50 text-primary-700"
                : "border-border bg-card text-secondary-600 hover:bg-muted"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </p>
      )}

      {submissions.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No submissions here"
          description="Send an intake link to a practice and their answers will land here ready to be turned into a project."
          action={
            <Button onClick={() => setIsOpen(true)}>
              <Send className="mr-2 size-4" />
              Create intake link
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Practice</th>
                  <th className="px-4 py-3 font-medium">Form</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Answers</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {submissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-muted">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/onboarding/submissions/${submission.id}`}
                        className="font-medium text-secondary-900 hover:underline"
                      >
                        {submission.practiceName ??
                          submission.contactName ??
                          "Awaiting response"}
                      </Link>
                      {submission.contactEmail && (
                        <p className="text-xs text-muted-foreground">
                          {submission.contactEmail}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {submission.form.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {submission.client ? (
                        <Link
                          href={`/dashboard/clients/${submission.client.id}`}
                          className="hover:underline"
                        >
                          {submission.client.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {submission._count.answers}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {submission.submittedAt
                        ? formatDate(submission.submittedAt)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge kind="submission" value={submission.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {submission.status === "INVITED" ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${window.location.origin}/onboarding/${submission.token}`
                            );
                            toast.success("Intake link copied.");
                          }}
                        >
                          <Copy className="mr-1.5 size-3.5" />
                          Link
                        </Button>
                      ) : (
                        <Button asChild size="xs" variant="ghost">
                          <Link
                            href={`/dashboard/onboarding/submissions/${submission.id}`}
                          >
                            Review
                          </Link>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) setInviteLink(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New intake link</DialogTitle>
            <DialogDescription>
              Pick the form to send and optionally attach it to an existing client.
            </DialogDescription>
          </DialogHeader>

          {inviteLink ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-xs text-secondary-700">
                  {inviteLink}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Copy link"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteLink);
                    toast.success("Copied.");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" asChild>
                  <a
                    href={inviteLink}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open the form in a new tab"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
              <DialogFooter className="flex-row justify-end gap-2">
                <Button asChild>
                  <a href={inviteLink} target="_blank" rel="noreferrer">
                    Open form
                  </a>
                </Button>
                <Button variant="ghost" onClick={() => setIsOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : forms.length === 0 ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                You need an intake form before you can send one.
              </p>
              <DialogFooter className="flex-row justify-end gap-2">
                <Button asChild>
                  <Link href="/dashboard/onboarding">Build a form</Link>
                </Button>
                <Button variant="ghost" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={onCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="form">Intake form</Label>
                <Select value={formId} onValueChange={setFormId}>
                  <SelectTrigger id="form">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {forms.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name} ({form.fieldCount} questions)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="clientId">Client</Label>
                <Select
                  value={clientId || "none"}
                  onValueChange={(value) =>
                    setClientId(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger id="clientId">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Create a new client from the answers
                    </SelectItem>
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
                  <Label htmlFor="practice">Practice name</Label>
                  <Input
                    id="practice"
                    value={practiceName}
                    onChange={(event) => setPracticeName(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Contact email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="flex-row justify-end gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Create link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
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
