"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClipboardList, Loader2, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { createOnboardingForm } from "@/lib/actions/onboarding";
import { formatDate } from "@/lib/utils";

interface FormRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  _count: { fields: number; submissions: number };
}

export function OnboardingFormsClient({
  forms,
  error,
}: {
  forms: FormRow[];
  error: string | null;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error: createError } = await createOnboardingForm({
        name,
        description,
      });

      if (createError || !data) {
        toast.error(createError ?? "Something went wrong.");
        return;
      }

      toast.success("Form created. Add your questions next.");
      setIsOpen(false);
      setName("");
      setDescription("");
      router.push(`/dashboard/onboarding/forms/${data.id}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Intake forms"
        description="Build the client onboarding questionnaire, including questions that only appear for the services a practice buys."
        actions={
          <Button onClick={() => setIsOpen(true)}>
            <Plus className="mr-2 size-4" />
            New form
          </Button>
        }
      />

      {error && (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </p>
      )}

      {forms.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No intake forms yet"
          description="Create your first onboarding questionnaire. Questions can branch based on the package and services a practice selects."
          action={
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="mr-2 size-4" />
              Create form
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {forms.map((form) => (
            <Link
              key={form.id}
              href={`/dashboard/onboarding/forms/${form.id}`}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-secondary-900">
                  {form.name}
                </p>
                <div className="flex shrink-0 gap-1.5">
                  {form.isDefault && <Badge>Default</Badge>}
                  <Badge variant={form.isActive ? "success" : "secondary"}>
                    {form.isActive ? "Active" : "Draft"}
                  </Badge>
                </div>
              </div>

              {form.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {form.description}
                </p>
              )}

              <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>{form._count.fields} questions</span>
                <span>{form._count.submissions} submissions</span>
                <span>{formatDate(form.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New intake form</DialogTitle>
            <DialogDescription>
              Name the questionnaire, then add questions and branching rules.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="formName">Form name</Label>
              <Input
                id="formName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Dental practice onboarding"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="formDescription">Description</Label>
              <Textarea
                id="formDescription"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="What this form collects and who it is for."
              />
            </div>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Create form
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
