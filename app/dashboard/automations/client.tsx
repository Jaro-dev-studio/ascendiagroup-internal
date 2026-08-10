"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Play, Plus, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  deleteAutomationRule,
  deleteTaskTemplate,
  runAutomationRule,
  saveAutomationRule,
  saveTaskTemplate,
} from "@/lib/actions/automations";
import { formatRelative, titleCase } from "@/lib/utils";

interface TemplateItem {
  id: string;
  title: string;
  description: string | null;
  offsetDays: number;
  priority: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  service: string | null;
  items: TemplateItem[];
}

interface Rule {
  id: string;
  name: string;
  trigger: string;
  isActive: boolean;
  lastRunAt: Date | null;
  runCount: number;
  template: { id: string; name: string } | null;
}

const SERVICES = [
  "SEO",
  "GOOGLE_ADS",
  "META_ADS",
  "WEBSITE",
  "GOOGLE_BUSINESS_PROFILE",
  "SOCIAL_MEDIA",
  "CONTENT",
  "REPUTATION",
  "CRM_AUTOMATION",
];

const TRIGGERS = [
  "ONBOARDING_SUBMITTED",
  "PROJECT_CREATED",
  "RECURRING_WEEKLY",
  "RECURRING_MONTHLY",
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

interface TemplateDraft {
  id?: string;
  name: string;
  description: string;
  service: string;
  items: { title: string; description: string; offsetDays: string; priority: string }[];
}

const EMPTY_TEMPLATE: TemplateDraft = {
  name: "",
  description: "",
  service: "",
  items: [{ title: "", description: "", offsetDays: "0", priority: "MEDIUM" }],
};

export function AutomationsClient({
  templates,
  rules,
}: {
  templates: Template[];
  rules: Rule[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<{
    id?: string;
    name: string;
    trigger: string;
    templateId: string;
    isActive: boolean;
  } | null>(null);
  const [isSavingRule, setIsSavingRule] = useState(false);

  async function onSaveTemplate(event: React.FormEvent) {
    event.preventDefault();
    if (!templateDraft) return;

    setIsSavingTemplate(true);
    try {
      const { error } = await saveTaskTemplate({
        id: templateDraft.id,
        name: templateDraft.name,
        description: templateDraft.description,
        service: templateDraft.service || undefined,
        items: templateDraft.items.map((item) => ({
          title: item.title,
          description: item.description,
          offsetDays: Number(item.offsetDays) || 0,
          priority: item.priority,
        })),
      });

      if (error) {
        toast.error(error);
        return;
      }

      toast.success("Template saved.");
      setTemplateDraft(null);
      router.refresh();
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function onSaveRule(event: React.FormEvent) {
    event.preventDefault();
    if (!ruleDraft) return;

    setIsSavingRule(true);
    try {
      const { error } = await saveAutomationRule(ruleDraft);
      if (error) {
        toast.error(error);
        return;
      }

      toast.success("Rule saved.");
      setRuleDraft(null);
      router.refresh();
    } finally {
      setIsSavingRule(false);
    }
  }

  function onRunRule(id: string) {
    startTransition(async () => {
      const { data, error } = await runAutomationRule(id);
      if (error) toast.error(error);
      else {
        toast.success(`Created ${data?.created ?? 0} tasks.`);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Automations"
        description="Task templates and the rules that apply them, so every practice gets the same delivery checklist without anyone rebuilding it."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                setRuleDraft({
                  name: "",
                  trigger: "ONBOARDING_SUBMITTED",
                  templateId: templates[0]?.id ?? "",
                  isActive: true,
                })
              }
              disabled={templates.length === 0}
            >
              <Workflow className="mr-2 size-4" />
              New rule
            </Button>
            <Button onClick={() => setTemplateDraft(EMPTY_TEMPLATE)}>
              <Plus className="mr-2 size-4" />
              New template
            </Button>
          </>
        }
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-secondary-500">
          Task templates
        </h2>

        {templates.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="No templates yet"
            description="A template is the checklist you run for every new practice. Onboarding rules use them to populate a project the moment an intake form is processed."
            action={
              <Button onClick={() => setTemplateDraft(EMPTY_TEMPLATE)}>
                Create the first template
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {templates.map((template) => (
              <Card key={template.id} className="group">
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>{template.name}</CardTitle>
                    {template.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {template.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {template.service && (
                      <Badge variant="secondary">
                        {titleCase(template.service)}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete template"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const { error } = await deleteTaskTemplate(template.id);
                          if (error) toast.error(error);
                          else router.refresh();
                        })
                      }
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5 text-danger-600" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ol className="flex flex-col divide-y divide-border">
                    {template.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                      >
                        <span className="min-w-0 truncate text-sm text-secondary-800">
                          {item.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <StatusBadge kind="priority" value={item.priority} />
                          <span className="text-xs text-muted-foreground">
                            +{item.offsetDays}d
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    onClick={() =>
                      setTemplateDraft({
                        id: template.id,
                        name: template.name,
                        description: template.description ?? "",
                        service: template.service ?? "",
                        items: template.items.map((item) => ({
                          title: item.title,
                          description: item.description ?? "",
                          offsetDays: String(item.offsetDays),
                          priority: item.priority,
                        })),
                      })
                    }
                  >
                    Edit template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-secondary-500">
          Rules
        </h2>

        {rules.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title="No automation rules"
            description="Attach a template to a trigger so onboarding submissions and retained work generate their tasks automatically."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {rules.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-secondary-900">
                        {rule.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {titleCase(rule.trigger)} ·{" "}
                        {rule.template?.name ?? "No template"} · ran{" "}
                        {rule.runCount} time(s)
                        {rule.lastRunAt
                          ? ` · last ${formatRelative(rule.lastRunAt)}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={rule.isActive ? "success" : "secondary"}>
                        {rule.isActive ? "Active" : "Paused"}
                      </Badge>
                      {rule.trigger !== "ONBOARDING_SUBMITTED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => onRunRule(rule.id)}
                        >
                          <Play className="mr-1.5 size-3.5" />
                          Run now
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setRuleDraft({
                            id: rule.id,
                            name: rule.name,
                            trigger: rule.trigger,
                            templateId: rule.template?.id ?? "",
                            isActive: rule.isActive,
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete rule"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            const { error } = await deleteAutomationRule(rule.id);
                            if (error) toast.error(error);
                            else router.refresh();
                          })
                        }
                      >
                        <Trash2 className="size-3.5 text-danger-600" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      <Dialog
        open={templateDraft !== null}
        onOpenChange={(open) => !open && setTemplateDraft(null)}
      >
        <DialogContent className="scrollbar-thin max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {templateDraft?.id ? "Edit template" : "New task template"}
            </DialogTitle>
            <DialogDescription>
              Each task is created relative to the day the template runs.
            </DialogDescription>
          </DialogHeader>

          {templateDraft && (
            <form onSubmit={onSaveTemplate} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="templateName">Name</Label>
                  <Input
                    id="templateName"
                    value={templateDraft.name}
                    onChange={(event) =>
                      setTemplateDraft({
                        ...templateDraft,
                        name: event.target.value,
                      })
                    }
                    placeholder="Standard practice onboarding"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="templateService">Service line</Label>
                  <Select
                    value={templateDraft.service || "any"}
                    onValueChange={(value) =>
                      setTemplateDraft({
                        ...templateDraft,
                        service: value === "any" ? "" : value,
                      })
                    }
                  >
                    <SelectTrigger id="templateService">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any service</SelectItem>
                      {SERVICES.map((service) => (
                        <SelectItem key={service} value={service}>
                          {titleCase(service)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="templateDescription">Description</Label>
                <Textarea
                  id="templateDescription"
                  rows={2}
                  value={templateDraft.description}
                  onChange={(event) =>
                    setTemplateDraft({
                      ...templateDraft,
                      description: event.target.value,
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-3">
                <Label>Tasks</Label>
                {templateDraft.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-end"
                  >
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Input
                        value={item.title}
                        onChange={(event) => {
                          const items = [...templateDraft.items];
                          items[index] = { ...item, title: event.target.value };
                          setTemplateDraft({ ...templateDraft, items });
                        }}
                        placeholder="Task title"
                      />
                    </div>

                    <div className="flex w-full gap-2 sm:w-auto">
                      <Input
                        type="number"
                        min="0"
                        className="w-24"
                        value={item.offsetDays}
                        onChange={(event) => {
                          const items = [...templateDraft.items];
                          items[index] = {
                            ...item,
                            offsetDays: event.target.value,
                          };
                          setTemplateDraft({ ...templateDraft, items });
                        }}
                        placeholder="Days"
                      />

                      <Select
                        value={item.priority}
                        onValueChange={(value) => {
                          const items = [...templateDraft.items];
                          items[index] = { ...item, priority: value };
                          setTemplateDraft({ ...templateDraft, items });
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {titleCase(priority)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove task"
                        onClick={() =>
                          setTemplateDraft({
                            ...templateDraft,
                            items: templateDraft.items.filter(
                              (_, itemIndex) => itemIndex !== index
                            ),
                          })
                        }
                      >
                        <Trash2 className="size-4 text-danger-600" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setTemplateDraft({
                      ...templateDraft,
                      items: [
                        ...templateDraft.items,
                        {
                          title: "",
                          description: "",
                          offsetDays: "0",
                          priority: "MEDIUM",
                        },
                      ],
                    })
                  }
                >
                  <Plus className="mr-2 size-4" />
                  Add task
                </Button>
              </div>

              <DialogFooter className="flex-row justify-end gap-2">
                <Button type="submit" disabled={isSavingTemplate}>
                  {isSavingTemplate && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Save template
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setTemplateDraft(null)}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={ruleDraft !== null}
        onOpenChange={(open) => !open && setRuleDraft(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ruleDraft?.id ? "Edit rule" : "New automation rule"}
            </DialogTitle>
            <DialogDescription>
              Intake rules fire when a submission is processed. Recurring rules are
              run on demand from this page.
            </DialogDescription>
          </DialogHeader>

          {ruleDraft && (
            <form onSubmit={onSaveRule} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ruleName">Name</Label>
                <Input
                  id="ruleName"
                  value={ruleDraft.name}
                  onChange={(event) =>
                    setRuleDraft({ ...ruleDraft, name: event.target.value })
                  }
                  placeholder="Apply onboarding checklist"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ruleTrigger">Trigger</Label>
                <Select
                  value={ruleDraft.trigger}
                  onValueChange={(value) =>
                    setRuleDraft({ ...ruleDraft, trigger: value })
                  }
                >
                  <SelectTrigger id="ruleTrigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((trigger) => (
                      <SelectItem key={trigger} value={trigger}>
                        {titleCase(trigger)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ruleTemplate">Task template</Label>
                <Select
                  value={ruleDraft.templateId}
                  onValueChange={(value) =>
                    setRuleDraft({ ...ruleDraft, templateId: value })
                  }
                >
                  <SelectTrigger id="ruleTemplate">
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-2 text-sm text-secondary-700">
                <Checkbox
                  checked={ruleDraft.isActive}
                  onCheckedChange={(checked) =>
                    setRuleDraft({ ...ruleDraft, isActive: checked === true })
                  }
                />
                Active
              </label>

              <DialogFooter className="flex-row justify-end gap-2">
                <Button type="submit" disabled={isSavingRule}>
                  {isSavingRule && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save rule
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRuleDraft(null)}
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
