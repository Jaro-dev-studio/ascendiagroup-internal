"use client";

import { useState, useTransition } from "react";
import { Copy, Eye, Loader2, Send, Settings2 } from "lucide-react";
import { toast } from "sonner";
import type { ConditionOperator, FieldType } from "@prisma/client";

import { FormBuilder, type BuilderField } from "@/components/forms/form-builder";
import { OnboardingFormRenderer } from "@/components/forms/onboarding-form-renderer";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createSubmissionInvite,
  updateOnboardingForm,
} from "@/lib/actions/onboarding";

interface FormDetail {
  id: string;
  name: string;
  description: string | null;
  intro: string | null;
  isActive: boolean;
  isDefault: boolean;
  fields: {
    id: string;
    section: string;
    label: string;
    helpText: string | null;
    type: FieldType;
    options: string[];
    isRequired: boolean;
    isCredential: boolean;
    order: number;
    conditionalFieldId: string | null;
    conditionOperator: ConditionOperator | null;
    conditionValues: string[];
  }[];
  _count: { submissions: number };
}

export function FormDetailClient({
  form,
  clients,
}: {
  form: FormDetail;
  clients: { id: string; name: string }[];
}) {
  const [, startTransition] = useTransition();
  const [settings, setSettings] = useState({
    name: form.name,
    description: form.description ?? "",
    intro: form.intro ?? "",
    isActive: form.isActive,
    isDefault: form.isDefault,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [invite, setInvite] = useState({
    clientId: "",
    practiceName: "",
    contactName: "",
    contactEmail: "",
  });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  async function onSaveSettings(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const { error } = await updateOnboardingForm(form.id, settings);
      if (error) toast.error(error);
      else toast.success("Form settings saved.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onCreateInvite(event: React.FormEvent) {
    event.preventDefault();
    setIsInviting(true);

    try {
      const { data, error } = await createSubmissionInvite({
        formId: form.id,
        clientId: invite.clientId || undefined,
        practiceName: invite.practiceName || undefined,
        contactName: invite.contactName || undefined,
        contactEmail: invite.contactEmail || undefined,
      });

      if (error || !data) {
        toast.error(error ?? "Something went wrong.");
        return;
      }

      const link = `${window.location.origin}/onboarding/${data.token}`;
      setInviteLink(link);
      navigator.clipboard.writeText(link).catch(() => undefined);
      toast.success("Intake link created and copied.");
      startTransition(() => undefined);
    } finally {
      setIsInviting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={form.name}
        description={
          form.description ??
          "Build the questions, branching rules and credential requests for this intake."
        }
        actions={
          <Button onClick={() => setIsInviteOpen(true)}>
            <Send className="mr-2 size-4" />
            Send to client
          </Button>
        }
      />

      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder">
            <Settings2 className="mr-2 size-4" />
            Builder
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="mr-2 size-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="builder">
          <FormBuilder
            formId={form.id}
            fields={form.fields as unknown as BuilderField[]}
          />
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Client view</CardTitle>
            </CardHeader>
            <CardContent>
              {form.fields.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Add questions in the builder to see the client view.
                </p>
              ) : (
                <OnboardingFormRenderer fields={form.fields} isPreview />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Form settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSaveSettings} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={settings.name}
                    onChange={(event) =>
                      setSettings({ ...settings, name: event.target.value })
                    }
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="description">Internal description</Label>
                  <Textarea
                    id="description"
                    rows={2}
                    value={settings.description}
                    onChange={(event) =>
                      setSettings({ ...settings, description: event.target.value })
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="intro">Introduction shown to the client</Label>
                  <Textarea
                    id="intro"
                    rows={4}
                    value={settings.intro}
                    onChange={(event) =>
                      setSettings({ ...settings, intro: event.target.value })
                    }
                    placeholder="Explain what you need and roughly how long it takes."
                  />
                </div>

                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm text-secondary-700">
                    <Checkbox
                      checked={settings.isActive}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, isActive: checked === true })
                      }
                    />
                    Active
                  </label>
                  <label className="flex items-center gap-2 text-sm text-secondary-700">
                    <Checkbox
                      checked={settings.isDefault}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, isDefault: checked === true })
                      }
                    />
                    Use as the default intake form
                  </label>
                </div>

                <div>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Save settings
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={isInviteOpen}
        onOpenChange={(open) => {
          setIsInviteOpen(open);
          if (!open) setInviteLink(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this form</DialogTitle>
            <DialogDescription>
              Generates a unique link the practice can complete without signing in.
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
              </div>
              <DialogFooter className="flex-row justify-end gap-2">
                <Button
                  onClick={() => {
                    setInviteLink(null);
                    setInvite({
                      clientId: "",
                      practiceName: "",
                      contactName: "",
                      contactEmail: "",
                    });
                  }}
                >
                  Create another
                </Button>
                <Button variant="ghost" onClick={() => setIsInviteOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={onCreateInvite} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client">Existing client</Label>
                <Select
                  value={invite.clientId || "none"}
                  onValueChange={(value) =>
                    setInvite({
                      ...invite,
                      clientId: value === "none" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Create a new client from the answers" />
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

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="practiceName">Practice name</Label>
                <Input
                  id="practiceName"
                  value={invite.practiceName}
                  onChange={(event) =>
                    setInvite({ ...invite, practiceName: event.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="contactName">Contact name</Label>
                  <Input
                    id="contactName"
                    value={invite.contactName}
                    onChange={(event) =>
                      setInvite({ ...invite, contactName: event.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="contactEmail">Contact email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={invite.contactEmail}
                    onChange={(event) =>
                      setInvite({ ...invite, contactEmail: event.target.value })
                    }
                  />
                </div>
              </div>

              <DialogFooter className="flex-row justify-end gap-2">
                <Button type="submit" disabled={isInviting}>
                  {isInviting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Create link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsInviteOpen(false)}
                  disabled={isInviting}
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
